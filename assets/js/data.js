/* =============================================================================
 * data.js — loading the prepared exam data.
 *
 * The site is fully static: this module reads JSON files that were produced
 * offline by the generator app. There is no API, no LLM and no network service
 * behind it. Chapter banks are fetched lazily and cached in memory.
 *
 * Two transports are supported, in order:
 *   1. fetch() of data/manifest.json + data/questions/*.json  (normal hosting)
 *   2. data/bundle.js, injected as a <script>                 (file:// fallback,
 *      where browsers refuse fetch for local files)
 * ===========================================================================*/
(function (global) {
  'use strict';

  var DATA_ROOT = 'data/';
  var cache = { manifest: null, banks: {} };
  var bundlePromise = null;

  function isFileProtocol() {
    return global.location && global.location.protocol === 'file:';
  }

  /** Load data/bundle.js once and resolve with its payload. */
  function loadBundle() {
    if (global.__EXAM_BUNDLE__) return Promise.resolve(global.__EXAM_BUNDLE__);
    if (bundlePromise) return bundlePromise;

    bundlePromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = DATA_ROOT + 'bundle.js';
      script.onload = function () {
        if (global.__EXAM_BUNDLE__) resolve(global.__EXAM_BUNDLE__);
        else reject(new Error('bundle.js loaded but contained no exam data.'));
      };
      script.onerror = function () {
        reject(new Error('Could not load data/bundle.js.'));
      };
      document.head.appendChild(script);
    });
    return bundlePromise;
  }

  function fetchJSON(path) {
    return fetch(DATA_ROOT + path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + path);
      return res.json();
    });
  }

  /**
   * Fetch first, fall back to the bundle. Running straight off disk is a normal
   * way to use a static study tool, so it should not be a dead end.
   */
  function get(path, bundleKey) {
    var viaBundle = function (err) {
      return loadBundle().then(function (bundle) {
        var value = bundleKey(bundle);
        if (!value) throw err || new Error('Missing ' + path + ' in bundle.');
        return value;
      });
    };
    if (isFileProtocol() || typeof fetch !== 'function') return viaBundle(null);
    return fetchJSON(path).catch(viaBundle);
  }

  var Data = {
    /** Manifest: document info, chapters (with counts + topics) and exam presets. */
    loadManifest: function () {
      if (cache.manifest) return Promise.resolve(cache.manifest);
      return get('manifest.json', function (b) { return b.manifest; })
        .then(function (manifest) {
          if (!manifest || !Array.isArray(manifest.chapters)) {
            throw new Error('The manifest is malformed.');
          }
          manifest.chapters.forEach(function (chapter) {
            chapter.topics = chapter.topics || [];
          });
          cache.manifest = manifest;
          return manifest;
        });
    },

    /** One chapter's questions. Cached, so re-configuring an exam is instant. */
    loadChapter: function (chapter) {
      var code = chapter.code;
      if (cache.banks[code]) return Promise.resolve(cache.banks[code]);
      var file = (chapter.file || 'questions/' + code.toLowerCase() + '.json')
        .replace(/^questions\//, 'questions/');
      return get(file, function (b) { return b.banks && b.banks[code]; })
        .then(function (bank) {
          var questions = (bank.questions || []).map(function (q) {
            // Denormalise so a question is self-describing once detached
            // from its bank — the exam engine and review screen both rely on it.
            q.chapter = q.chapter || { code: code, name: chapter.name };
            if (!q.chapter.name) q.chapter.name = chapter.name;
            return q;
          });
          cache.banks[code] = questions;
          return questions;
        });
    },

    /** Load several chapters at once. */
    loadChapters: function (chapters) {
      return Promise.all(chapters.map(Data.loadChapter)).then(function (lists) {
        return lists.reduce(function (all, list) { return all.concat(list); }, []);
      });
    },

    clearCache: function () {
      cache = { manifest: null, banks: {} };
      bundlePromise = null;
      try { delete global.__EXAM_BUNDLE__; } catch (e) { global.__EXAM_BUNDLE__ = undefined; }
    }
  };

  global.ExamData = Data;
}(window));
