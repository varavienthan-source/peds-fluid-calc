# Paediatric Nephrology Calculator

An offline-capable PWA of paediatric nephrology calculations, in **Canadian SI units**, that shows its working for every result.

Built for practice in Hamilton, Ontario. The clinical source of truth is the
**Paediatric Nephrology Resident Handbook, 1st edition (2021), Canadian Association of
Paediatric Nephrologists** — authored predominantly at McMaster University.

## Why it shows the work

Every result renders the formula, the substituted numbers step by step, any unit
conversion applied, the clinical considerations, and the source. A number without its
derivation is not useful at the bedside and cannot be checked.

## Canadian SI units

Canadian labs report in SI, and several thresholds differ numerically from the US
figures that most published formulas assume. The app takes SI by default, converts
internally, and shows the conversion as a visible step.

| Analyte | SI (Canada) | Conventional | Factor |
|---|---|---|---|
| Creatinine | µmol/L | mg/dL | × 88.4 |
| Urea / BUN | mmol/L | mg/dL | × 2.8 |
| Glucose | mmol/L | mg/dL | × 18 |
| Calcium | mmol/L | mg/dL | × 4.0 |
| Albumin, Hemoglobin | g/L | g/dL | × 10 |
| Protein/creatinine, Albumin/creatinine | mg/mmol | mg/g | × 8.84 |

Notably, bedside Schwartz is stated by the handbook directly in SI as
`eGFR = 36.5 × height(cm) / Cr(µmol/L)`, and the nephrotic proteinuria threshold is
**250 mg/mmol** — roughly 2200 mg/g, a factor-of-nine trap if the units are confused.

## Live site

**https://varavienthan-source.github.io/peds-fluid-calc/**

Served by GitHub Pages from `main` at the repository root. Because it is a real origin,
the service worker registers — so the app installs to a phone home screen and keeps
working with no network. On iOS: open in Safari, then Share → Add to Home Screen.

To enable or re-enable Pages: repository **Settings → Pages → Source: Deploy from a
branch → Branch: `main` / `(root)` → Save**. The first build takes a minute or two.
Note that Pages sites are public even when the repository is private.

## Running locally

No build step and no dependencies. Serve the directory over HTTP — a real server is
required, because the service worker and manifest do not register on `file://`.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

```sh
node --test
```

Tests use Node's built-in runner against the same ES modules the browser loads.
The highest-value cases are the handbook's own worked examples — the sodium deficit
case (10 kg, Na 112→120 ⇒ 48 mmol ⇒ 13 mL/hr) and the free water deficit case
(9 kg, Na 174 ⇒ 1080 mL) — plus band-edge tests at every threshold and dual-unit
equivalence tests asserting SI and conventional entry agree.

## Structure

```
index.html          shell, design system, tab chrome
sw.js               offline cache (bump CACHE when the module list changes)
src/
  units.js          SI ↔ conventional conversion table
  descriptor.js     calculator descriptor helpers and input validation
  expression.js     safe arithmetic parser (shunting-yard, no eval)
  registry.js       index of all calculators
  calc/             one module per clinical domain
  ui/               generic form + result renderers, calculator tab
test/               node --test suites
```

Adding a calculator means adding a descriptor object to a `src/calc/*.js` module and
exporting it — the UI is generic over the descriptor shape, so no UI code is needed.

## Status

Chapters 1–7 of the handbook are implemented and source-backed. Chapters 8–16
(CKD, dialysis/RRT, transplant, urolithiasis, tubular disorders, UTI/VUR) did not
survive the PDF→Google Doc conversion and are pending; see `docs/handbook-status.md`.

## Disclaimer

Clinical decision support only. Verify every result against local protocol and
clinical judgement. Not a substitute for clinical decision-making.
