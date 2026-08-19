/* =============================================================================
 * exam.js — the exam engine.
 *
 * Pure state and logic: selecting a question set, recording answers, scoring.
 * It touches no DOM, which keeps it easy to reason about and to test.
 * ===========================================================================*/
(function (global) {
  'use strict';

  /* ----------------------------------------------------------- utilities -- */

  /** Fisher–Yates, on a copy. */
  function shuffle(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  /**
   * Spread a selection across chapters instead of taking a random sample, so a
   * 20-question "full mock" is not three-quarters cardiology just because that
   * chapter is the largest. Chapters are visited round-robin.
   */
  function stratify(questions, limit) {
    var groups = {}, order = [];
    questions.forEach(function (q) {
      var key = (q.chapter && q.chapter.code) || 'MISC';
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(q);
    });
    order.forEach(function (key) { groups[key] = shuffle(groups[key]); });
    order = shuffle(order);

    var picked = [], exhausted = 0;
    while (picked.length < limit && exhausted < order.length) {
      exhausted = 0;
      for (var i = 0; i < order.length && picked.length < limit; i++) {
        var bucket = groups[order[i]];
        if (bucket.length) picked.push(bucket.shift());
        else exhausted++;
      }
    }
    return shuffle(picked);
  }

  function matchesFilters(question, filters) {
    if (filters.chapters && filters.chapters.length) {
      var code = (question.chapter && question.chapter.code) || '';
      if (filters.chapters.indexOf(code) === -1) return false;
    }
    if (filters.topics && filters.topics.length) {
      if (filters.topics.indexOf(question.topic) === -1) return false;
    }
    if (filters.difficulties && filters.difficulties.length) {
      var d = question.difficulty || 'medium';
      if (filters.difficulties.indexOf(d) === -1) return false;
    }
    return true;
  }

  /* -------------------------------------------------------------- session -- */

  /**
   * @param {Object} config
   *   questions        {Array}  the full candidate pool
   *   count            {number} how many to ask ('all' -> everything matching)
   *   chapters/topics/difficulties {Array} filters
   *   shuffleAnswers   {boolean}
   *   instantFeedback  {boolean}
   *   examTitle        {string}
   */
  function ExamSession(config) {
    this.config = config;
    this.examTitle = config.examTitle || 'Mock exam';
    this.instantFeedback = config.instantFeedback !== false;

    var pool = config.questions.filter(function (q) {
      return matchesFilters(q, config);
    });

    var limit = config.count === 'all'
      ? pool.length
      : Math.min(parseInt(config.count, 10) || 20, pool.length);

    this.questions = stratify(pool, limit).map(function (q) {
      // Copy so shuffling answer order never mutates the cached bank.
      var copy = Object.assign({}, q);
      copy.options = config.shuffleAnswers === false ? q.options.slice() : shuffle(q.options);
      return copy;
    });

    this.poolSize = pool.length;
    this.index = 0;
    this.answers = {};                 // questionId -> { selected, correct, skipped }
    this.startedAt = Date.now();
    this.finishedAt = null;
  }

  ExamSession.prototype = {
    get total() { return this.questions.length; },
    get current() { return this.questions[this.index] || null; },
    get isLast() { return this.index >= this.questions.length - 1; },

    isAnswered: function (question) {
      var q = question || this.current;
      return !!(q && this.answers[q.id]);
    },

    resultFor: function (question) {
      return this.answers[question.id] || null;
    },

    /** Record an answer. Passing null marks the question skipped. */
    answer: function (optionId) {
      var q = this.current;
      if (!q || this.answers[q.id]) return this.answers[q && q.id];
      var record = {
        questionId: q.id,
        selected: optionId,
        correct: optionId === q.correctAnswer,
        skipped: optionId === null || optionId === undefined,
        at: Date.now()
      };
      this.answers[q.id] = record;
      return record;
    },

    next: function () {
      if (this.isLast) {
        this.finish();
        return false;
      }
      this.index++;
      return true;
    },

    finish: function () {
      if (!this.finishedAt) this.finishedAt = Date.now();
    },

    get progress() {
      return {
        index: this.index,
        number: this.index + 1,
        total: this.total,
        answered: Object.keys(this.answers).length,
        correct: this.countBy('correct'),
        incorrect: this.countBy('incorrect'),
        skipped: this.countBy('skipped'),
        percentComplete: this.total ? Math.round((Object.keys(this.answers).length / this.total) * 100) : 0
      };
    },

    countBy: function (kind) {
      var n = 0, self = this;
      Object.keys(this.answers).forEach(function (id) {
        var a = self.answers[id];
        if (kind === 'correct' && a.correct) n++;
        else if (kind === 'skipped' && a.skipped) n++;
        else if (kind === 'incorrect' && !a.correct && !a.skipped) n++;
      });
      return n;
    },

    /** Final score plus a per-chapter breakdown for the results screen. */
    get summary() {
      var correct = this.countBy('correct');
      var total = this.total;
      var byChapter = {};

      this.questions.forEach(function (q) {
        var key = (q.chapter && q.chapter.name) || q.topic || 'Other';
        if (!byChapter[key]) byChapter[key] = { name: key, total: 0, correct: 0 };
        byChapter[key].total++;
      }, this);

      var self = this;
      this.questions.forEach(function (q) {
        var a = self.answers[q.id];
        if (a && a.correct) {
          byChapter[(q.chapter && q.chapter.name) || q.topic || 'Other'].correct++;
        }
      });

      return {
        title: this.examTitle,
        total: total,
        correct: correct,
        incorrect: this.countBy('incorrect'),
        skipped: total - Object.keys(this.answers).length + this.countBy('skipped'),
        percent: total ? Math.round((correct / total) * 100) : 0,
        durationMs: (this.finishedAt || Date.now()) - this.startedAt,
        breakdown: Object.keys(byChapter)
          .map(function (k) { return byChapter[k]; })
          .sort(function (a, b) {
            return (a.correct / a.total) - (b.correct / b.total) || b.total - a.total;
          })
      };
    },

    /** Questions answered incorrectly or skipped — used by "retry incorrect". */
    get missedQuestions() {
      var self = this;
      return this.questions.filter(function (q) {
        var a = self.answers[q.id];
        return !a || !a.correct;
      });
    },

    /** Ordered review rows: question, what was chosen, and the outcome. */
    get review() {
      var self = this;
      return this.questions.map(function (q, i) {
        var a = self.answers[q.id];
        var outcome = !a ? 'skipped' : (a.correct ? 'correct' : (a.skipped ? 'skipped' : 'incorrect'));
        return { number: i + 1, question: q, answer: a, outcome: outcome };
      });
    }
  };

  global.ExamEngine = {
    ExamSession: ExamSession,
    shuffle: shuffle,
    stratify: stratify,
    matchesFilters: matchesFilters,

    /** How many questions match a filter set — powers the live config summary. */
    countMatching: function (questions, filters) {
      return questions.reduce(function (n, q) {
        return matchesFilters(q, filters) ? n + 1 : n;
      }, 0);
    },

    formatDuration: function (ms) {
      var s = Math.max(0, Math.round(ms / 1000));
      var m = Math.floor(s / 60);
      var h = Math.floor(m / 60);
      if (h) return h + 'h ' + (m % 60) + 'm';
      if (m) return m + 'm ' + (s % 60) + 's';
      return s + 's';
    }
  };
}(window));
