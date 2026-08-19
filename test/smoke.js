/* =============================================================================
 * smoke.js — headless checks for the exam site.
 *
 * Runs the real exam engine against the real exported data, and cross-checks
 * the markup against the ids the scripts actually reach for. No browser and no
 * dependencies: just `node test/smoke.js` from the web/ directory.
 * ===========================================================================*/
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

let failures = 0;
let checks = 0;

function check(label, condition, detail) {
  checks++;
  if (condition) return true;
  failures++;
  console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  return false;
}

function section(name) {
  console.log('\n' + name);
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/* ---------------------------------------------------------------- data ---- */
section('data');

const manifest = readJSON(path.join(DATA, 'manifest.json'));
check('manifest has chapters', Array.isArray(manifest.chapters) && manifest.chapters.length > 0);
check('manifest has exams', Array.isArray(manifest.exams) && manifest.exams.length > 0);

let allQuestions = [];
const ids = new Set();
const optionIdProblems = [];
const sourceProblems = [];

manifest.chapters.forEach((chapter) => {
  const file = path.join(DATA, chapter.file);
  if (!check(`chapter file exists: ${chapter.file}`, fs.existsSync(file))) return;
  const bank = readJSON(file);
  check(`${chapter.code}: manifest count matches file`,
    bank.questions.length === chapter.count,
    `manifest ${chapter.count} vs file ${bank.questions.length}`);

  bank.questions.forEach((q) => {
    if (ids.has(q.id)) optionIdProblems.push(`duplicate id ${q.id}`);
    ids.add(q.id);
    const optIds = q.options.map((o) => o.id);
    if (!optIds.includes(q.correctAnswer)) optionIdProblems.push(`${q.id}: answer not an option`);
    if (q.options.length < 3) optionIdProblems.push(`${q.id}: too few options`);
    if (!q.explanation) optionIdProblems.push(`${q.id}: no explanation`);
    if (!q.source || !q.source.document) sourceProblems.push(`${q.id}: no source document`);
    if (!q.source || q.source.page == null) sourceProblems.push(`${q.id}: no source page`);
    if (!q.chapter || q.chapter.code !== chapter.code) {
      optionIdProblems.push(`${q.id}: chapter mismatch`);
    }
    allQuestions.push(q);
  });
});

check('every question is structurally sound', optionIdProblems.length === 0,
  optionIdProblems.slice(0, 5).join('; '));
check('every question cites a source', sourceProblems.length === 0,
  sourceProblems.slice(0, 5).join('; '));
check('manifest total matches loaded questions',
  manifest.totalQuestions === allQuestions.length,
  `${manifest.totalQuestions} vs ${allQuestions.length}`);

manifest.exams.forEach((exam) => {
  if (exam.chapters === null) return;
  const known = new Set(manifest.chapters.map((c) => c.code));
  const missing = exam.chapters.filter((c) => !known.has(c));
  check(`exam "${exam.id}" references real chapters`, missing.length === 0, missing.join(','));
  const pool = manifest.chapters
    .filter((c) => exam.chapters.includes(c.code))
    .reduce((n, c) => n + c.count, 0);
  check(`exam "${exam.id}" pool size is accurate`, pool === exam.poolSize,
    `${exam.poolSize} vs ${pool}`);
});

/* -------------------------------------------------------------- bundle ---- */
section('file:// fallback bundle');

const bundleSrc = fs.readFileSync(path.join(DATA, 'bundle.js'), 'utf8');
const bundleCtx = { window: {} };
vm.createContext(bundleCtx);
vm.runInContext(bundleSrc, bundleCtx);
const bundle = bundleCtx.window.__EXAM_BUNDLE__;
check('bundle defines __EXAM_BUNDLE__', !!bundle);
check('bundle manifest matches the JSON manifest',
  bundle && bundle.manifest.totalQuestions === manifest.totalQuestions);
check('bundle carries every chapter bank',
  bundle && Object.keys(bundle.banks).length === manifest.chapters.length);

/* -------------------------------------------------------------- engine ---- */
section('exam engine');

const sandbox = { window: {}, Math: Math, Date: Date, Object: Object, JSON: JSON, console: console };
sandbox.window.ExamEngine = undefined;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/exam.js'), 'utf8'), sandbox);
const Engine = sandbox.window.ExamEngine;
check('engine loaded', !!Engine);

// a 40-question mixed exam
const session = new Engine.ExamSession({
  questions: allQuestions,
  count: 40,
  chapters: [],
  topics: [],
  difficulties: [],
  shuffleAnswers: true,
  examTitle: 'Smoke test'
});
check('session drew the requested number', session.total === 40, String(session.total));
check('session questions are unique',
  new Set(session.questions.map((q) => q.id)).size === session.total);
check('stratification spread across chapters',
  new Set(session.questions.map((q) => q.chapter.code)).size >= 8,
  String(new Set(session.questions.map((q) => q.chapter.code)).size));

// shuffling answers must not corrupt the correct answer
const corrupted = session.questions.filter(
  (q) => !q.options.some((o) => o.id === q.correctAnswer)
);
check('shuffling preserves the correct answer', corrupted.length === 0);

// the shuffled copy must not mutate the shared bank ordering
const original = allQuestions.find((q) => q.id === session.questions[0].id);
check('bank objects are not mutated by shuffling',
  original.options !== session.questions[0].options);

// answer everything: alternate correct / wrong / skipped
let expectCorrect = 0;
let expectWrong = 0;
let expectSkipped = 0;
for (let i = 0; i < 40; i++) {
  const q = session.current;
  const wrong = q.options.find((o) => o.id !== q.correctAnswer);
  if (i % 3 === 0) { session.answer(q.correctAnswer); expectCorrect++; }
  else if (i % 3 === 1) { session.answer(wrong.id); expectWrong++; }
  else { session.answer(null); expectSkipped++; }
  session.next();
}
const summary = session.summary;
check('score counts correct answers', summary.correct === expectCorrect,
  `${summary.correct} vs ${expectCorrect}`);
check('score counts incorrect answers', summary.incorrect === expectWrong,
  `${summary.incorrect} vs ${expectWrong}`);
check('score counts skipped answers', summary.skipped === expectSkipped,
  `${summary.skipped} vs ${expectSkipped}`);
check('percentage is consistent',
  summary.percent === Math.round((expectCorrect / 40) * 100));
check('every question appears in review', session.review.length === 40);
check('review outcomes are labelled',
  session.review.every((r) => ['correct', 'incorrect', 'skipped'].includes(r.outcome)));
check('missed questions = wrong + skipped',
  session.missedQuestions.length === expectWrong + expectSkipped);
check('breakdown totals reconcile',
  summary.breakdown.reduce((n, b) => n + b.total, 0) === 40);
check('answering twice does not double count', (() => {
  const before = session.progress.answered;
  session.answer('a');
  return session.progress.answered === before;
})());

// filters
const cardioOnly = new Engine.ExamSession({
  questions: allQuestions, count: 'all', chapters: ['C'], topics: [], difficulties: [],
  examTitle: 'Cardio'
});
check('chapter filter restricts the pool',
  cardioOnly.questions.every((q) => q.chapter.code === 'C') && cardioOnly.total > 0,
  String(cardioOnly.total));

const easyOnly = new Engine.ExamSession({
  questions: allQuestions, count: 'all', chapters: [], topics: [], difficulties: ['easy'],
  examTitle: 'Easy'
});
check('difficulty filter restricts the pool',
  easyOnly.questions.every((q) => (q.difficulty || 'medium') === 'easy') && easyOnly.total > 0,
  String(easyOnly.total));

const impossible = new Engine.ExamSession({
  questions: allQuestions, count: 20, chapters: ['C'], topics: ['Nothing At All'],
  difficulties: [], examTitle: 'Empty'
});
check('impossible filter yields an empty exam, not a crash', impossible.total === 0);

const overAsk = new Engine.ExamSession({
  questions: allQuestions, count: 10000, chapters: [], topics: [], difficulties: [],
  examTitle: 'Over'
});
check('asking for more than exists is clamped', overAsk.total === allQuestions.length);

check('duration formats', Engine.formatDuration(65000) === '1m 5s',
  Engine.formatDuration(65000));

/* ---------------------------------------------------------------- wiring -- */
section('markup wiring');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

const jsFiles = ['app.js', 'ui.js', 'data.js', 'exam.js'];
const referenced = new Set();
jsFiles.forEach((name) => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js', name), 'utf8');
  for (const m of src.matchAll(/\bel\('([^']+)'\)/g)) referenced.add(m[1]);
});

const missingIds = [...referenced].filter((id) => !htmlIds.has(id));
check('every id the scripts touch exists in the markup', missingIds.length === 0,
  missingIds.join(', '));

// screens the UI switches between must all be present
['loading', 'error', 'select', 'config', 'question', 'results', 'review'].forEach((screen) => {
  check(`screen-${screen} exists`, htmlIds.has('screen-' + screen));
});

// stylesheet and scripts referenced by the page must exist on disk
[...html.matchAll(/(?:src|href)="((?:assets|data)\/[^"]+)"/g)].forEach((m) => {
  check(`asset exists: ${m[1]}`, fs.existsSync(path.join(ROOT, m[1])));
});

check('no localStorage misuse outside the theme toggle', (() => {
  const app = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
  const hits = app.match(/localStorage/g) || [];
  return hits.length <= 2;
})());

/* --------------------------------------------------------------- report --- */
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
console.log('all good');
