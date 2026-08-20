# Handbook extraction status

## Source

**Paediatric Nephrology Resident Handbook, 1st edition (2021)**
Canadian Association of Paediatric Nephrologists.
Authors predominantly McMaster University (AlShammri, AlTamimi, Bamhraz, Chanchlani, Jenkins);
supervising editor Charushree Prasad; reviewed nationally.

Supplied as a Google Doc converted from the original PDF.

## What converted

The PDF→Google Doc conversion **truncated at page 74 of 181**. Chapters 1–7 are
complete; chapters 8–16 produced no text.

| Chapter | Status | Implemented |
|---|---|---|
| 1 History & Physical Exam | ✅ text | reference only |
| 2 Diagnostic Tests | ✅ text | Schwartz eGFR, PCR, ACR, 24h protein |
| 3 Kidney Development | ✅ text | reference only |
| 4 Fluids and Electrolytes | ✅ text | maintenance, Na deficit, FWD, osmolality, TTKG, hyperkalemia, acid–base |
| 5 Acute Kidney Injury | ✅ text | KDIGO staging, FENa/FEUrea, %FO, physiologic maintenance |
| 6 Approach to Proteinuria | ✅ text | PCR/ACR thresholds, nephrotic steroid dosing |
| 7 Hypertension in Children | ✅ text | BP classification (Hypertension Canada + AAP) |
| 8 Hematuria / Glomerulonephritis | ❌ missing | — |
| 9 Chronic Kidney Disease | ❌ missing | CKiD U25 shipped from Pierce 2021, unverified against handbook |
| 10 Renal Replacement Therapy | ❌ missing | — |
| 11 Kidney Transplantation | ❌ missing | — |
| 12 Thrombotic Microangiopathy | ❌ missing | — |
| 13 CAKUT and Cystic Kidney Disease | ❌ missing | — |
| 14 Urolithiasis | ❌ missing | — |
| 15 Tubular Disorders | ❌ missing | — |
| 16 UTI and Vesicoureteral Reflux | ❌ missing | — |

## Also missing: image-only content

Two items are embedded images even within the converted range and did not extract:

- **The body surface area formula** (referenced at ch.4 "Formula for Body Surface Area:"
  and ch.5 "Formula for BSA"). The app currently uses Mosteller as default with Haycock
  and Du Bois as alternatives; this needs confirming against the handbook's choice.
- **Figure 7.1, blood pressure categories and definitions.** Without it, BP percentile
  classification falls back to the simplified absolute thresholds that both
  Hypertension Canada and the AAP explicitly endorse. Full percentile classification
  needs the AAP normative tables plus a height-for-age z-score.

## To complete

Commit the original PDF to this repository on the working branch. All 181 pages can
then be extracted locally, including the image-only content, and every shipped
constant reconciled against it.

## Values taken directly from the handbook

These differ from commonly cited US figures and were taken verbatim:

- Bedside Schwartz stated in SI: `eGFR = 36.5 × height(cm) / Cr(µmol/L)`
- Free water deficit: `0.6 × weight × [(Na_actual − Na_desired) / Na_desired]` — denominator is the *desired* sodium
- Sodium deficit: `0.6 × weight × (desired − current Na)`, plus maintenance Na ≈ 2 mmol/kg/day
- Insensible losses: 400 mL/m²/day (300–500 in AKI)
- PCR normal: <50 mg/mmol under 2 y, <20 mg/mmol over 2 y; nephrotic >250 mg/mmol
- ACR: <2.5 normal, 2–20 mildly ↑, 20–220 moderately ↑, >220 nephrotic
- 24h protein: normal <100 mg/m²/day, nephrotic >1000 mg/m²/day
- KDIGO AKI stage 3 in children: eGFR <35 mL/min/1.73m² (not the adult 353 µmol/L)
- TTKG cut-off 6 (not the commonly quoted 7), with the handbook's own validity caveats
- Hypertension Canada: >120/80 (6–11 y), >130/85 (12–17 y) — differs from AAP's ≥130/80 from age 13
- Metabolic alkalosis compensation: `expected pCO₂ = 0.7 × HCO₃ + 20 ± 1.5`
