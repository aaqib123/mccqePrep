# MCCQE Part I Practice Exam

A static, self-contained mock exam for MCCQE Part I preparation. **822 single-best-answer clinical vignettes** across 32 specialties, each with a worked explanation grounded in *Toronto Notes 2025* (41st edition).

**→ [Take an exam](https://aaqib123.github.io/mccqePrep/)**

No account, no backend, no tracking. The whole thing is HTML, CSS and vanilla JavaScript reading pre-built JSON.

---

## Exam modes

Pick a preset, choose how many questions you want, and sit it. Questions are sampled at random from the pool each time, so the same preset gives a different paper on every attempt.

| Preset | Focus | Default | Pool |
|---|---|---:|---:|
| **Full mock exam** | Mixed questions from every chapter | 40 | 822 |
| **Internal medicine** | Cardio, resp, GI, endo, nephro, heme, ID, neuro, rheum, geri | 30 | 279 |
| **Surgery** | General/thoracic, ortho, neurosurg, plastics, uro, vascular, ENT, ophtho, anesthesia | 30 | 227 |
| **Acute and emergency care** | The unwell patient in front of you | 25 | 173 |
| **Primary care and population health** | FM, psych, derm, public health, palliative, ethics | 30 | 146 |
| **Women's and children's health** | Obstetrics, gynecology, pediatrics | 25 | 108 |

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
| Questions | 822 |
| Chapters | 32 |
| Distinct topics | ~790 |
| Difficulty | ~22% easy, ~52% medium, ~27% hard |

Every question carries a chapter, topic, difficulty rating, and an explanation that states the reasoning rather than just naming the answer. Chapter weighting roughly tracks each specialty's footprint on the exam — Pediatrics carries 51 questions and Cardiology 42; Medical Genetics carries 7.

<details>
<summary>Full chapter list</summary>

| Code | Chapter | Q |
|---|---|---:|
| A | Anesthesia | 20 |
| C | Cardiology and Cardiac Surgery | 42 |
| CP | Clinical Pharmacology | 10 |
| D | Dermatology | 32 |
| E | Endocrinology | 34 |
| ELOM | Ethical, Legal, and Organizational Medicine | 19 |
| ER | Emergency Medicine | 38 |
| FM | Family Medicine | 27 |
| G | Gastroenterology | 27 |
| GM | Geriatric Medicine | 13 |
| GS | General and Thoracic Surgery | 38 |
| GY | Gynecology | 28 |
| H | Hematology | 36 |
| ID | Infectious Diseases | 33 |
| MG | Medical Genetics | 7 |
| MI | Medical Imaging | 17 |
| N | Neurology | 34 |
| NP | Nephrology | 23 |
| NS | Neurosurgery | 32 |
| OB | Obstetrics | 29 |
| OP | Ophthalmology | 26 |
| OR | Orthopedic Surgery | 30 |
| OT | Otolaryngology | 25 |
| P | Pediatrics | 51 |
| PH | Public Health and Preventive Medicine | 19 |
| PL | Plastic Surgery | 24 |
| PM | Palliative Medicine | 7 |
| PS | Psychiatry | 32 |
| R | Respirology | 18 |
| RH | Rheumatology | 19 |
| U | Urology | 24 |
| VS | Vascular Surgery | 8 |

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

- 822 questions is a study aid, not exam-scale coverage. A real MCCQE Part I sitting draws on far more material.
- Explanations reflect *Toronto Notes 2025*. Guidelines move; verify anything clinically important against a current primary source.
- Text-only. There are no images, ECGs, or radiographs, which are a real part of the exam.
- A score here is a rough signal about recall of this reference, not a predicted exam result.

Clinical content is for study purposes and is not medical advice.
