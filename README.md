# MCCQE Part I Practice Exam

A static, self-contained mock exam for MCCQE Part I preparation. **722 single-best-answer clinical vignettes** across 32 specialties, each with a worked explanation grounded in *Toronto Notes 2025* (41st edition).

**→ [Take an exam](https://aaqib123.github.io/mccqePrep/)**

No account, no backend, no tracking. The whole thing is HTML, CSS and vanilla JavaScript reading pre-built JSON.

---

## Exam modes

Pick a preset, choose how many questions you want, and sit it. Questions are sampled at random from the pool each time, so the same preset gives a different paper on every attempt.

| Preset | Focus | Default | Pool |
|---|---|---:|---:|
| **Full mock exam** | Mixed questions from every chapter | 40 | 722 |
| **Internal medicine** | Cardio, resp, GI, endo, nephro, heme, ID, neuro, rheum, geri | 30 | 245 |
| **Surgery** | General/thoracic, ortho, neurosurg, plastics, uro, vascular, ENT, ophtho, anesthesia | 30 | 199 |
| **Acute and emergency care** | The unwell patient in front of you | 25 | 155 |
| **Primary care and population health** | FM, psych, derm, public health, palliative, ethics | 30 | 127 |
| **Women's and children's health** | Obstetrics, gynecology, pediatrics | 25 | 96 |

You can also build a custom paper by selecting individual chapters.

## During and after the exam

- **Flag for review** — mark uncertain questions and jump back to them from the navigator
- **Question navigator** — see at a glance what's answered, flagged, or untouched
- **Timer** — optional, sized to the question count
- **Score report** — overall result plus a per-chapter breakdown showing where you're weak
- **Full review** — every question with your answer, the correct answer, and the explanation

Progress is held in memory for the sitting. Closing the tab ends the attempt.

## The question bank

| | |
|---|---:|
| Questions | 722 |
| Chapters | 32 |
| Distinct topics | ~690 |
| Difficulty | ~25% easy, ~51% medium, ~24% hard |

Every question carries a chapter, topic, difficulty rating, and an explanation that states the reasoning rather than just naming the answer. Chapter weighting roughly tracks each specialty's footprint on the exam — Pediatrics carries 47 questions and Cardiology 38; Medical Genetics carries 6.

<details>
<summary>Full chapter list</summary>

| Code | Chapter | Q |
|---|---|---:|
| A | Anesthesia | 18 |
| C | Cardiology and Cardiac Surgery | 38 |
| CP | Clinical Pharmacology | 8 |
| D | Dermatology | 28 |
| E | Endocrinology | 30 |
| ELOM | Ethical, Legal, and Organizational Medicine | 17 |
| ER | Emergency Medicine | 34 |
| FM | Family Medicine | 23 |
| G | Gastroenterology | 23 |
| GM | Geriatric Medicine | 11 |
| GS | General and Thoracic Surgery | 34 |
| GY | Gynecology | 24 |
| H | Hematology | 32 |
| ID | Infectious Diseases | 29 |
| MG | Medical Genetics | 6 |
| MI | Medical Imaging | 15 |
| N | Neurology | 30 |
| NP | Nephrology | 19 |
| NS | Neurosurgery | 28 |
| OB | Obstetrics | 25 |
| OP | Ophthalmology | 22 |
| OR | Orthopedic Surgery | 26 |
| OT | Otolaryngology | 22 |
| P | Pediatrics | 47 |
| PH | Public Health and Preventive Medicine | 17 |
| PL | Plastic Surgery | 22 |
| PM | Palliative Medicine | 6 |
| PS | Psychiatry | 28 |
| R | Respirology | 16 |
| RH | Rheumatology | 17 |
| U | Urology | 21 |
| VS | Vascular Surgery | 6 |

</details>

## Running it locally

Clone the repo and serve the directory over HTTP:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly off disk also works. Browsers block `fetch` on `file://` URLs, so the app falls back to `data/bundle.js`, which carries the same content as a script tag.

## Tests

```bash
node test/smoke.js
```

No dependencies. The smoke suite runs the real exam engine against the real exported data and cross-checks `index.html` for the element IDs the scripts reach for — so a renamed DOM node or a malformed question file fails loudly instead of silently breaking the UI.

## Layout

```
index.html            markup for every screen (setup, exam, results, review)
assets/css/styles.css
assets/js/data.js     loads the manifest and chapter banks; fetch → bundle fallback
assets/js/exam.js     sampling, scoring, timing — no DOM access
assets/js/ui.js       rendering and event wiring
assets/js/app.js      bootstrap
data/manifest.json    document info, chapter index, exam presets
data/questions/*.json one bank per chapter
data/bundle.js        all of the above inlined, for file:// use
test/smoke.js
```

`exam.js` is deliberately DOM-free, which is what lets the smoke tests exercise the scoring logic in Node without a browser.

### Question format

```json
{
  "id": "TN-C-001",
  "type": "single-best-answer",
  "question": "A 66-year-old man with exertional angina undergoes...",
  "options": [{ "id": "a", "text": "Right coronary artery" }],
  "correctAnswer": "a",
  "explanation": "Toronto Notes lists the branches of the RCA as...",
  "topic": "Coronary Anatomy",
  "difficulty": "medium"
}
```

Adding questions means appending to the relevant `data/questions/*.json`, updating the counts in `manifest.json`, and regenerating `bundle.js`.

## Provenance and limitations

Questions were authored against the full text of *Toronto Notes 2025*, extracted from a 1,595-page source with OCR, then validated back against that corpus. They are **original vignettes** written to test the reference's content — not reproduced exam material, and not affiliated with or endorsed by the Medical Council of Canada or the Toronto Notes editorial board.

Worth knowing before you rely on it:

- 722 questions is a study aid, not exam-scale coverage. A real MCCQE Part I sitting draws on far more material.
- Explanations reflect *Toronto Notes 2025*. Guidelines move; verify anything clinically important against a current primary source.
- Text-only. There are no images, ECGs, or radiographs, which are a real part of the exam.
- A score here is a rough signal about recall of this reference, not a predicted exam result.

Clinical content is for study purposes and is not medical advice.
