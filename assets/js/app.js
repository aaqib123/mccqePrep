/* =============================================================================
 * app.js — wiring: screen flow, event handling, keyboard shortcuts.
 * ===========================================================================*/
(function (global) {
  'use strict';

  var UI = global.ExamUI;
  var Engine = global.ExamEngine;
  var Data = global.ExamData;
  var el = UI.el;

  var COUNT_CHOICES = [10, 20, 30, 40, 60, 'all'];

  var state = {
    manifest: null,
    exam: null,          // the selected preset
    pool: [],            // questions loaded for the selected preset
    session: null,
    selectedOption: null,
    config: {
      count: 20,
      chapters: new Set(),
      topics: new Set(),
      difficulties: new Set(['easy', 'medium', 'hard'])
    },
    reviewFilter: 'all'
  };

  /* ----------------------------------------------------------------- boot -- */
  function boot() {
    setupTheme();
    bindGlobalEvents();
    load();
  }

  function load() {
    UI.showScreen('loading');
    Data.loadManifest()
      .then(function (manifest) {
        state.manifest = manifest;
        if (!manifest.totalQuestions) {
          UI.renderStats(manifest);
          UI.renderExamList(manifest, chooseExam);
          UI.showScreen('select');
          UI.show(el('select-empty'), true);
          return;
        }
        UI.renderStats(manifest);
        UI.renderExamList(manifest, chooseExam);
        UI.showScreen('select');
      })
      .catch(function (err) {
        showError(err);
      });
  }

  function showError(err) {
    el('error-message').textContent =
      (err && err.message) || 'Something went wrong while loading the exam data.';
    UI.showScreen('error');
  }

  /* ------------------------------------------------------ exam selection -- */
  function chooseExam(exam) {
    state.exam = exam;
    UI.showScreen('loading');

    var chapters = state.manifest.chapters.filter(function (c) {
      return !exam.chapters || exam.chapters.indexOf(c.code) !== -1;
    });

    Data.loadChapters(chapters)
      .then(function (questions) {
        state.pool = questions;
        state.config.chapters = new Set(chapters.map(function (c) { return c.code; }));
        state.config.topics = new Set();
        state.config.difficulties = new Set(['easy', 'medium', 'hard']);
        state.config.count = Math.min(exam.defaultCount || 20, questions.length);
        if (COUNT_CHOICES.indexOf(state.config.count) === -1) {
          state.config.count = COUNT_CHOICES.filter(function (c) {
            return c !== 'all' && c <= questions.length;
          }).pop() || 'all';
        }
        renderConfig();
        UI.showScreen('config');
      })
      .catch(showError);
  }

  /* -------------------------------------------------------- config screen -- */
  function chapterMeta() {
    return state.manifest.chapters.filter(function (c) {
      return !state.exam.chapters || state.exam.chapters.indexOf(c.code) !== -1;
    });
  }

  function renderConfig() {
    el('config-subtitle').textContent = state.exam.description || '';

    UI.renderCountOptions(
      COUNT_CHOICES.filter(function (c) { return c === 'all' || c <= state.pool.length; }),
      state.config.count,
      function (value) { state.config.count = value; renderConfig(); }
    );

    var chapters = chapterMeta();
    var filterText = (el('chapter-search').value || '').toLowerCase();
    UI.renderCheckboxes(
      el('chapter-options'),
      chapters
        .filter(function (c) {
          return !filterText || c.name.toLowerCase().indexOf(filterText) !== -1 ||
                 c.code.toLowerCase().indexOf(filterText) !== -1;
        })
        .map(function (c) { return { value: c.code, label: c.name, count: c.count }; }),
      state.config.chapters,
      function (code, on) {
        if (on) state.config.chapters.add(code); else state.config.chapters.delete(code);
        // Drop topic filters that belong to chapters no longer in scope.
        var live = new Set();
        availableTopics().forEach(function (t) { live.add(t.value); });
        state.config.topics.forEach(function (t) { if (!live.has(t)) state.config.topics.delete(t); });
        renderConfig();
      }
    );
    el('chapter-note').textContent =
      state.config.chapters.size + ' of ' + chapters.length + ' selected';

    var topics = availableTopics();
    UI.renderCheckboxes(el('topic-options'), topics, state.config.topics,
      function (topic, on) {
        if (on) state.config.topics.add(topic); else state.config.topics.delete(topic);
        renderConfig();
      });
    el('topic-note').textContent = state.config.topics.size
      ? state.config.topics.size + ' topic' + (state.config.topics.size === 1 ? '' : 's') + ' selected'
      : 'All topics in the selected chapters';
    UI.show(el('topic-group'), topics.length > 1);

    UI.renderCheckboxes(
      el('difficulty-options'),
      ['easy', 'medium', 'hard'].map(function (d) {
        return {
          value: d,
          label: d.charAt(0).toUpperCase() + d.slice(1),
          count: state.pool.filter(function (q) { return (q.difficulty || 'medium') === d; }).length
        };
      }),
      state.config.difficulties,
      function (d, on) {
        if (on) state.config.difficulties.add(d); else state.config.difficulties.delete(d);
        renderConfig();
      }
    );

    updateSummary();
  }

  function availableTopics() {
    var counts = {};
    state.pool.forEach(function (q) {
      var code = q.chapter && q.chapter.code;
      if (state.config.chapters.size && !state.config.chapters.has(code)) return;
      if (!q.topic) return;
      counts[q.topic] = (counts[q.topic] || 0) + 1;
    });
    return Object.keys(counts).sort().map(function (t) {
      return { value: t, label: t, count: counts[t] };
    });
  }

  function currentFilters() {
    return {
      chapters: Array.from(state.config.chapters),
      topics: Array.from(state.config.topics),
      difficulties: Array.from(state.config.difficulties)
    };
  }

  function updateSummary() {
    var matching = Engine.countMatching(state.pool, currentFilters());
    var asked = state.config.count === 'all'
      ? matching
      : Math.min(state.config.count, matching);
    var summary = el('config-summary');
    var start = el('start-exam');

    if (matching === 0) {
      summary.textContent = 'No questions match these filters — widen your selection.';
      start.disabled = true;
      return;
    }
    start.disabled = false;
    summary.textContent = asked + ' question' + (asked === 1 ? '' : 's') +
      ' drawn from a pool of ' + matching + '.';
  }

  /* ------------------------------------------------------ exam execution -- */
  function startExam(questions, titleSuffix) {
    var filters = currentFilters();
    state.session = new Engine.ExamSession({
      questions: questions || state.pool,
      count: questions ? 'all' : state.config.count,
      chapters: questions ? [] : filters.chapters,
      topics: questions ? [] : filters.topics,
      difficulties: questions ? [] : filters.difficulties,
      shuffleAnswers: el('opt-shuffle-answers').checked,
      instantFeedback: el('opt-instant-feedback').checked,
      examTitle: state.exam.title + (titleSuffix || '')
    });

    if (!state.session.total) {
      updateSummary();
      return;
    }
    UI.show(el('progress-rail'), true);
    UI.show(el('quit-exam'), true);
    showQuestion();
    UI.showScreen('question');
  }

  function showQuestion() {
    var session = state.session;
    var question = session.current;
    state.selectedOption = null;

    UI.renderQuestion(question, session.progress);
    UI.renderOptions(el('options-list'), question, null, function (optionId) {
      state.selectedOption = optionId;
      el('submit-answer').disabled = false;
    });

    el('submit-answer').disabled = true;
    UI.show(el('submit-answer'), true);
    UI.show(el('next-question'), false);
    UI.show(el('skip-question'), true);
  }

  function submitAnswer(optionId) {
    var session = state.session;
    var question = session.current;
    var record = session.answer(optionId === undefined ? state.selectedOption : optionId);

    if (session.instantFeedback) {
      UI.renderOptions(el('options-list'), question, record);
      UI.renderFeedback(question, record);
    } else {
      // exam-style: no reveal, but the answer is locked in
      UI.qsa('.option', el('options-list')).forEach(function (option) {
        option.classList.add('is-locked');
        var input = option.querySelector('input');
        if (input) input.disabled = true;
      });
    }
    UI.renderProgress(session.progress);

    UI.show(el('submit-answer'), false);
    UI.show(el('skip-question'), false);
    var next = el('next-question');
    next.textContent = session.isLast ? 'Finish exam' : 'Next question';
    UI.show(next, true);
    next.focus();
  }

  function nextQuestion() {
    if (state.session.next()) {
      showQuestion();
      global.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      finishExam();
    }
  }

  function finishExam() {
    state.session.finish();
    UI.show(el('progress-rail'), false);
    UI.show(el('quit-exam'), false);
    UI.renderResults(state.session.summary);
    UI.showScreen('results');
  }

  function backToExams() {
    state.session = null;
    UI.show(el('progress-rail'), false);
    UI.show(el('quit-exam'), false);
    UI.showScreen('select');
  }

  /* ----------------------------------------------------------------- bind -- */
  function bindGlobalEvents() {
    el('error-retry').addEventListener('click', function () {
      Data.clearCache();
      load();
    });

    el('config-back').addEventListener('click', backToExams);
    el('chapter-search').addEventListener('input', renderConfig);

    el('chapters-all').addEventListener('click', function () {
      chapterMeta().forEach(function (c) { state.config.chapters.add(c.code); });
      renderConfig();
    });
    el('chapters-none').addEventListener('click', function () {
      state.config.chapters.clear();
      state.config.topics.clear();
      renderConfig();
    });
    el('topics-all').addEventListener('click', function () {
      availableTopics().forEach(function (t) { state.config.topics.add(t.value); });
      renderConfig();
    });
    el('topics-none').addEventListener('click', function () {
      state.config.topics.clear();
      renderConfig();
    });

    el('config-form').addEventListener('submit', function (event) {
      event.preventDefault();
      startExam(null, '');
    });

    el('submit-answer').addEventListener('click', function () {
      if (state.selectedOption) submitAnswer();
    });
    el('skip-question').addEventListener('click', function () { submitAnswer(null); });
    el('next-question').addEventListener('click', nextQuestion);

    el('quit-exam').addEventListener('click', function () {
      var progress = state.session && state.session.progress;
      var pending = progress && progress.answered < progress.total;
      if (pending && !global.confirm('End this exam and see your results so far?')) return;
      finishExam();
    });

    el('review-answers').addEventListener('click', function () {
      state.reviewFilter = 'all';
      syncFilterButtons();
      UI.renderReview(state.session.review, 'all');
      UI.showScreen('review');
    });
    el('retry-wrong').addEventListener('click', function () {
      var missed = state.session.missedQuestions;
      if (!missed.length) {
        global.alert('Nothing to retry — you answered every question correctly.');
        return;
      }
      startExam(missed, ' — retry');
    });
    el('back-to-exams').addEventListener('click', backToExams);
    el('review-to-exams').addEventListener('click', backToExams);
    el('review-back').addEventListener('click', function () { UI.showScreen('results'); });

    UI.qsa('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.reviewFilter = btn.getAttribute('data-filter');
        syncFilterButtons();
        UI.renderReview(state.session.review, state.reviewFilter);
      });
    });

    document.addEventListener('keydown', onKeyDown);
  }

  function syncFilterButtons() {
    UI.qsa('.filter-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-filter') === state.reviewFilter);
    });
  }

  /* ------------------------------------------------------------ keyboard -- */
  function onKeyDown(event) {
    if (el('screen-question').classList.contains('is-hidden')) return;
    var tag = (event.target.tagName || '').toLowerCase();
    if (tag === 'input' && event.target.type === 'search') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    var session = state.session;
    if (!session) return;
    var answered = session.isAnswered();

    // 1–5 pick an option
    if (/^[1-9]$/.test(event.key) && !answered) {
      var i = parseInt(event.key, 10) - 1;
      var inputs = UI.qsa('.option input', el('options-list'));
      if (inputs[i]) {
        event.preventDefault();
        inputs[i].checked = true;
        inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
        // focus the radio itself — the wrapping label is not focusable, so
        // focusing it would silently drop the keyboard user's position
        inputs[i].focus();
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (answered) nextQuestion();
      else if (state.selectedOption) submitAnswer();
      return;
    }

    if (event.key.toLowerCase() === 's' && !answered) {
      event.preventDefault();
      submitAnswer(null);
    }
  }

  /* --------------------------------------------------------------- theme -- */
  function setupTheme() {
    var stored = null;
    try { stored = global.localStorage.getItem('mccqe-theme'); } catch (e) { /* private mode */ }
    var initial = stored ||
      (global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(initial);

    el('theme-toggle').addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { global.localStorage.setItem('mccqe-theme', next); } catch (e) { /* ignore */ }
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    el('theme-icon').textContent = theme === 'dark' ? '☀' : '☾';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}(window));
