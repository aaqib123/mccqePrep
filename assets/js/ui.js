/* =============================================================================
 * ui.js — DOM helpers and the render functions for each screen.
 * Rendering only; all decisions live in exam.js and app.js.
 * ===========================================================================*/
(function (global) {
  'use strict';

  var LETTERS = 'ABCDE FGHIJ'.replace(' ', '');

  function el(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function show(node, visible) {
    if (node) node.classList.toggle('is-hidden', !visible);
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  /* -------------------------------------------------------------- screens -- */
  var SCREENS = ['loading', 'error', 'select', 'config', 'question', 'results', 'review'];

  function showScreen(name) {
    SCREENS.forEach(function (s) { show(el('screen-' + s), s === name); });
    var main = el('main');
    if (main) {
      main.focus({ preventScroll: true });
      global.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  /* ------------------------------------------------------ exam selection -- */
  function renderStats(manifest) {
    var strip = el('bank-stats');
    clear(strip);
    var topics = manifest.chapters.reduce(function (n, c) { return n + (c.topics || []).length; }, 0);
    [
      [manifest.totalQuestions, 'questions'],
      [manifest.chapters.length, 'chapters'],
      [topics, 'topics'],
      [manifest.document && manifest.document.title, '']
    ].forEach(function (pair) {
      if (pair[0] == null || pair[0] === '') return;
      var span = make('span');
      span.appendChild(make('b', null, String(pair[0])));
      if (pair[1]) span.appendChild(document.createTextNode(pair[1]));
      strip.appendChild(span);
    });
  }

  function renderExamList(manifest, onSelect) {
    var list = el('exam-list');
    clear(list);
    var exams = manifest.exams || [];
    show(el('select-empty'), exams.length === 0);

    exams.forEach(function (exam) {
      var li = make('li');
      var card = make('button', 'exam-card');
      card.type = 'button';
      card.setAttribute('data-accent', exam.accent || 'teal');

      card.appendChild(make('span', 'exam-tagline', exam.tagline || ''));
      card.appendChild(make('h2', null, exam.title));
      card.appendChild(make('p', 'exam-desc', exam.description || ''));

      var foot = make('span', 'exam-foot');
      var scope = exam.chapters ? exam.chapters.length + ' chapters' : 'All chapters';
      foot.appendChild(make('span', null, scope));
      foot.appendChild(make('span', null, exam.poolSize + ' questions available'));
      card.appendChild(foot);

      card.addEventListener('click', function () { onSelect(exam); });
      li.appendChild(card);
      list.appendChild(li);
    });
  }

  /* --------------------------------------------------------- config form -- */
  function renderCountOptions(options, selected, onChange) {
    var host = el('count-options');
    clear(host);
    options.forEach(function (value) {
      var btn = make('button', null, value === 'all' ? 'All' : String(value));
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(value === selected));
      btn.addEventListener('click', function () { onChange(value); });
      host.appendChild(btn);
    });
  }

  function renderCheckboxes(host, items, checkedSet, onToggle) {
    clear(host);
    items.forEach(function (item) {
      var row = make('label', 'check-row');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = item.value;
      input.checked = checkedSet.has(item.value);
      input.disabled = item.count === 0;
      input.addEventListener('change', function () { onToggle(item.value, input.checked); });

      row.appendChild(input);
      row.appendChild(make('span', 'row-label', item.label));
      if (item.count != null) row.appendChild(make('span', 'row-count', String(item.count)));
      row.title = item.label + (item.count != null ? ' — ' + item.count + ' questions' : '');
      host.appendChild(row);
    });
  }

  /* ------------------------------------------------------------ question -- */
  function renderProgress(progress) {
    el('progress-count').textContent = 'Question ' + progress.number + ' of ' + progress.total;
    el('progress-correct').textContent = progress.correct + ' correct';
    el('progress-wrong').textContent = progress.incorrect + ' incorrect';
    var pct = progress.total ? Math.round((progress.index / progress.total) * 100) : 0;
    el('progress-fill').style.width = pct + '%';
    el('progress-bar').setAttribute('aria-valuenow', String(pct));
  }

  /**
   * Build the answer list. `state` is null while unanswered; once answered it
   * carries the selection so the same renderer can also draw the review screen.
   */
  function renderOptions(host, question, state, onSelect) {
    clear(host);
    var legend = make('legend', 'sr-only', 'Select the single best answer');
    host.appendChild(legend);

    question.options.forEach(function (option, i) {
      var locked = !!state;
      var label = make('label', 'option');
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'answer-' + question.id;
      input.value = option.id;
      input.disabled = locked;

      if (state) {
        label.classList.add('is-locked');
        var isCorrect = option.id === question.correctAnswer;
        var isChosen = option.id === state.selected;
        if (isCorrect) label.classList.add('is-correct');
        else if (isChosen) label.classList.add('is-incorrect');
        else label.classList.add('is-muted');
        if (isChosen) input.checked = true;
      }

      label.appendChild(input);
      label.appendChild(make('span', 'option-key', LETTERS[i] || String(i + 1)));
      label.appendChild(make('span', 'option-text', option.text));

      if (state) {
        if (option.id === question.correctAnswer) {
          label.appendChild(make('span', 'option-mark', '✓'));
          label.querySelector('.option-mark').setAttribute('aria-label', 'Correct answer');
        } else if (option.id === state.selected) {
          label.appendChild(make('span', 'option-mark', '✗'));
          label.querySelector('.option-mark').setAttribute('aria-label', 'Your answer, incorrect');
        }
      } else {
        input.addEventListener('change', function () {
          qsa('.option', host).forEach(function (o) { o.classList.remove('is-selected'); });
          label.classList.add('is-selected');
          onSelect(option.id);
        });
      }

      host.appendChild(label);
    });
  }

  function sourceLine(question) {
    var wrap = make('div', 'source-ref');
    var src = question.source || {};
    wrap.appendChild(make('span', 'src-label', 'Source'));
    wrap.appendChild(make('span', 'src-doc', src.document || 'Source document'));
    if (src.reference) wrap.appendChild(make('span', 'src-loc', src.reference));
    if (src.page) wrap.appendChild(make('span', 'src-loc', 'PDF p.' + src.page));
    return wrap;
  }

  function renderFeedback(question, state) {
    var box = el('feedback');
    box.classList.remove('is-correct', 'is-incorrect', 'is-skipped');

    var outcome = state.skipped ? 'skipped' : (state.correct ? 'correct' : 'incorrect');
    box.classList.add('is-' + outcome);
    el('feedback-badge').textContent =
      outcome === 'correct' ? 'Correct' : (outcome === 'skipped' ? 'Skipped' : 'Incorrect');

    var correctOption = question.options.filter(function (o) {
      return o.id === question.correctAnswer;
    })[0];
    var answerLine = el('feedback-answer');
    clear(answerLine);
    if (outcome !== 'correct' && correctOption) {
      answerLine.appendChild(document.createTextNode('The correct answer is '));
      answerLine.appendChild(make('b', null, correctOption.text));
    }

    el('feedback-explanation').textContent = question.explanation || '';

    var host = el('feedback-distractors');
    clear(host);
    var notes = question.optionExplanations;
    if (notes) {
      var grid = make('div', 'distractors');
      question.options.forEach(function (option) {
        if (option.id === question.correctAnswer || !notes[option.id]) return;
        var row = make('div', 'distractor');
        row.appendChild(make('b', null, option.text + ' — '));
        row.appendChild(document.createTextNode(notes[option.id]));
        grid.appendChild(row);
      });
      if (grid.childNodes.length) host.appendChild(grid);
    }

    var oldSource = qs('.source-ref', box);
    if (oldSource) oldSource.remove();
    qs('.feedback-body', box).appendChild(sourceLine(question));

    show(box, true);
  }

  function renderQuestion(question, progress) {
    renderProgress(progress);
    el('q-topic').textContent =
      (question.chapter && question.chapter.name) || question.topic || 'General';
    var diff = el('q-difficulty');
    diff.textContent = question.difficulty || 'medium';
    show(diff, !!question.difficulty);
    el('question-text').textContent = question.question;
    show(el('feedback'), false);
  }

  /* ------------------------------------------------------------- results -- */
  function renderResults(summary) {
    el('results-subtitle').textContent =
      summary.title + ' — ' + summary.total + ' questions, finished in ' +
      global.ExamEngine.formatDuration(summary.durationMs) + '.';

    el('score-percent').textContent = summary.percent + '%';
    el('score-fraction').textContent = summary.correct + ' / ' + summary.total;
    el('res-correct').textContent = summary.correct;
    el('res-wrong').textContent = summary.incorrect;
    el('res-skipped').textContent = summary.skipped;
    el('res-time').textContent = global.ExamEngine.formatDuration(summary.durationMs);

    var dial = el('score-dial');
    dial.classList.toggle('is-pass', summary.percent >= 60);
    dial.classList.toggle('is-fail', summary.percent < 60);
    var circumference = 2 * Math.PI * 52;
    // Defer so the transition actually runs from the 0% state.
    global.requestAnimationFrame(function () {
      el('dial-value').style.strokeDashoffset =
        String(circumference * (1 - summary.percent / 100));
    });

    var list = el('breakdown-list');
    clear(list);
    summary.breakdown.forEach(function (row) {
      var pct = Math.round((row.correct / row.total) * 100);
      var li = make('li', 'breakdown-row');
      var head = make('div', 'breakdown-head');
      head.appendChild(make('b', null, row.name));
      head.appendChild(make('span', null, row.correct + '/' + row.total + '  ·  ' + pct + '%'));
      var track = make('div', 'breakdown-track');
      var fill = make('div', 'breakdown-fill' + (pct < 50 ? ' is-weak' : pct < 75 ? ' is-mid' : ''));
      fill.style.width = pct + '%';
      track.appendChild(fill);
      li.appendChild(head);
      li.appendChild(track);
      list.appendChild(li);
    });
  }

  /* -------------------------------------------------------------- review -- */
  function renderReview(rows, filter) {
    var list = el('review-list');
    clear(list);
    var visible = rows.filter(function (r) { return filter === 'all' || r.outcome === filter; });
    show(el('review-empty'), visible.length === 0);

    visible.forEach(function (row) {
      var q = row.question;
      var item = make('li', 'review-item');
      item.setAttribute('data-outcome', row.outcome);

      var details = make('details');
      var summary = make('summary', 'review-summary');
      summary.appendChild(make('span', 'review-num', String(row.number)));
      summary.appendChild(make('span', 'review-q', q.question));
      summary.appendChild(make('span', 'review-outcome', row.outcome));
      details.appendChild(summary);

      var body = make('div', 'review-body');
      var meta = make('div', 'question-meta');
      meta.appendChild(make('span', 'pill', (q.chapter && q.chapter.name) || 'General'));
      if (q.topic) meta.appendChild(make('span', 'pill pill-quiet', q.topic));
      if (q.difficulty) meta.appendChild(make('span', 'pill pill-quiet', q.difficulty));
      body.appendChild(meta);

      var options = make('fieldset', 'options');
      renderOptions(options, q, row.answer || { selected: null, correct: false, skipped: true });
      body.appendChild(options);

      body.appendChild(make('h3', 'feedback-h', 'Explanation'));
      body.appendChild(make('p', null, q.explanation || ''));

      if (q.optionExplanations) {
        var grid = make('div', 'distractors');
        q.options.forEach(function (option) {
          if (option.id === q.correctAnswer || !q.optionExplanations[option.id]) return;
          var line = make('div', 'distractor');
          line.appendChild(make('b', null, option.text + ' — '));
          line.appendChild(document.createTextNode(q.optionExplanations[option.id]));
          grid.appendChild(line);
        });
        if (grid.childNodes.length) body.appendChild(grid);
      }

      body.appendChild(sourceLine(q));
      details.appendChild(body);
      item.appendChild(details);
      list.appendChild(item);
    });
  }

  global.ExamUI = {
    el: el, qs: qs, qsa: qsa, show: show, make: make, clear: clear,
    showScreen: showScreen,
    renderStats: renderStats,
    renderExamList: renderExamList,
    renderCountOptions: renderCountOptions,
    renderCheckboxes: renderCheckboxes,
    renderQuestion: renderQuestion,
    renderOptions: renderOptions,
    renderFeedback: renderFeedback,
    renderProgress: renderProgress,
    renderResults: renderResults,
    renderReview: renderReview,
    LETTERS: LETTERS
  };
}(window));
