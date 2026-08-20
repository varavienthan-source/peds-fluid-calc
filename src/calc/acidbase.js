/** Acid-base interpretation. Formulas per CAPN Resident Handbook (2021) ch.4. */
'use strict';

import { fmt } from '../fmt.js';
import { step, interpret, LEVEL, requireNumber, requireRange, requireAnalyte } from '../descriptor.js';

export const anionGap = {
  id: 'anion-gap',
  category: 'Acid–base',
  title: 'Anion Gap',
  source: 'CAPN Handbook 2021, ch.4 — Acid-Base Disorders',
  formula: 'AG = Na − (Cl + HCO₃)   ·   normal 8–12 mmol/L',
  inputs: [
    { key: 'sodium', label: 'Sodium', unit: 'mmol/L', min: 90, max: 200, step: 1 },
    { key: 'chloride', label: 'Chloride', unit: 'mmol/L', min: 50, max: 150, step: 1 },
    { key: 'bicarbonate', label: 'Bicarbonate', unit: 'mmol/L', min: 2, max: 50, step: 1 },
    { key: 'albumin', label: 'Albumin (for correction)', unit: 'g/L', min: 5, max: 60, step: 1, optional: true, analyte: 'albumin' },
  ],
  compute(v) {
    const na = requireRange(v.sodium, 90, 200, 'Sodium', 'sodium');
    const cl = requireRange(v.chloride, 50, 150, 'Chloride', 'chloride');
    const hco3 = requireRange(v.bicarbonate, 2, 50, 'Bicarbonate', 'bicarbonate');

    const ag = na - (cl + hco3);
    const steps = [
      step('Sum the measured anions', `${fmt(cl)} + ${fmt(hco3)}`, `${fmt(cl + hco3)} mmol/L`),
      step('Subtract from sodium', `${fmt(na)} − ${fmt(cl + hco3)}`, `${fmt(ag)} mmol/L`),
    ];

    const extra = [{ label: 'Anion gap', value: fmt(ag), unit: 'mmol/L' }];
    let effective = ag;

    if (v.albumin) {
      const alb = requireAnalyte('albumin', v.albumin, v.albuminUnit, 3, 70, 'Albumin', 'albumin').value;
      const corr = ag + 0.25 * (40 - alb);
      steps.push(step('Correct for albumin (0.25 per g/L below 40)', `${fmt(ag)} + 0.25 × (40 − ${fmt(alb)})`, `${fmt(corr)} mmol/L`));
      extra.push({ label: 'Albumin-corrected AG', value: fmt(corr), unit: 'mmol/L' });
      effective = corr;
    }

    let interp;
    if (effective > 12) {
      interp = interpret(LEVEL.WARN, `High anion gap (${fmt(effective)} mmol/L)`,
        'MUDPILES: Methanol, Uremia, DKA, Paraldehyde/propylene glycol, Iron/inborn errors, Lactate, Ethylene glycol, Salicylates.');
    } else if (effective < 8) {
      interp = interpret(LEVEL.INFO, `Low anion gap (${fmt(effective)} mmol/L)`,
        'Consider hypoalbuminemia, lithium, bromide, or paraproteinemia.');
    } else {
      interp = interpret(LEVEL.NORMAL, `Normal anion gap (${fmt(effective)} mmol/L)`,
        hco3 < 22 ? 'With a low bicarbonate this is a normal-anion-gap (hyperchloremic) acidosis — think renal or GI bicarbonate loss. Check the urine anion gap.' : undefined);
    }

    return { value: effective, unit: 'mmol/L', label: 'Anion gap', steps, extra, interpretation: interp };
  },
  considerations: [
    'Hypoalbuminemia masks a raised anion gap — every 10 g/L fall in albumin lowers the apparent gap by about 2.5 mmol/L. In nephrotic syndrome, always correct.',
    'A normal anion gap with low bicarbonate points to bicarbonate loss (renal or GI). The urine anion gap distinguishes them.',
    'Potassium is omitted here. Some laboratories include it, which shifts the normal range up by about 4 mmol/L — know your local convention.',
    'Always pair the anion gap with a compensation check; mixed disorders are common and easily missed.',
  ],
};

export const compensation = {
  id: 'acid-base-compensation',
  category: 'Acid–base',
  title: 'Expected Respiratory Compensation',
  source: 'CAPN Handbook 2021, ch.4',
  formula: 'Metabolic acidosis: expected pCO₂ = 1.5 × HCO₃ + 8 ± 2   ·   Metabolic alkalosis: expected pCO₂ = 0.7 × HCO₃ + 20 ± 1.5',
  inputs: [
    { key: 'bicarbonate', label: 'Bicarbonate', unit: 'mmol/L', min: 2, max: 50, step: 1 },
    { key: 'pco2', label: 'Measured pCO₂', unit: 'mmHg', min: 5, max: 120, step: 1 },
    {
      key: 'disorder', label: 'Primary disorder', type: 'select', default: 'acidosis',
      options: [
        { value: 'acidosis', label: 'Metabolic acidosis' },
        { value: 'alkalosis', label: 'Metabolic alkalosis' },
      ],
    },
  ],
  compute(v) {
    const hco3 = requireRange(v.bicarbonate, 2, 50, 'Bicarbonate', 'bicarbonate');
    const pco2 = requireRange(v.pco2, 5, 120, 'pCO₂', 'pco2');
    const disorder = v.disorder || 'acidosis';

    let expected, tol, formulaText;
    if (disorder === 'acidosis') {
      expected = 1.5 * hco3 + 8;
      tol = 2;
      formulaText = `1.5 × ${fmt(hco3)} + 8`;
    } else {
      expected = 0.7 * hco3 + 20;
      tol = 1.5;
      formulaText = `0.7 × ${fmt(hco3)} + 20`;
    }
    const low = expected - tol;
    const high = expected + tol;

    const steps = [
      step(`Expected pCO₂ for ${disorder === 'acidosis' ? 'metabolic acidosis' : 'metabolic alkalosis'}`,
        formulaText, `${fmt(expected, 1)} mmHg`),
      step('Acceptable range', `${fmt(expected, 1)} ± ${fmt(tol, 1)}`, `${fmt(low, 1)} – ${fmt(high, 1)} mmHg`),
      step('Compare with measured', `measured ${fmt(pco2)} mmHg`,
        pco2 < low ? 'below range' : pco2 > high ? 'above range' : 'within range'),
    ];

    let interp;
    if (pco2 >= low && pco2 <= high) {
      interp = interpret(LEVEL.NORMAL, 'Compensation is appropriate — a single primary disorder.');
    } else if (pco2 < low) {
      interp = interpret(LEVEL.WARN, 'pCO₂ is lower than expected — a concurrent respiratory alkalosis is present.');
    } else {
      interp = interpret(LEVEL.WARN, 'pCO₂ is higher than expected — a concurrent respiratory acidosis is present.');
    }

    return {
      value: expected, unit: 'mmHg', label: 'Expected pCO₂', decimals: 1,
      steps,
      extra: [
        { label: 'Expected pCO₂', value: `${fmt(low, 1)} – ${fmt(high, 1)}`, unit: 'mmHg' },
        { label: 'Measured pCO₂', value: fmt(pco2), unit: 'mmHg' },
        { label: 'Difference', value: fmt(pco2 - expected, 1), unit: 'mmHg' },
      ],
      interpretation: interp,
    };
  },
  considerations: [
    'Compensation always moves pH toward normal but never overcorrects past it. A "compensated" pH on the wrong side of 7.40 tells you which disorder is primary.',
    'Respiratory compensation is fast (minutes to hours); metabolic compensation for a respiratory disorder takes days. Timing tells you whether a respiratory picture is acute or chronic.',
    'For primary respiratory disorders, use the ΔHCO₃ : ΔpCO₂ ratios per 10 mmHg — acute acidosis 1:10, acute alkalosis 2:10, chronic acidosis 3:10, chronic alkalosis 4:10.',
    'If compensation is not as expected, a mixed disorder is present — look for a second cause rather than assuming measurement error.',
  ],
};

export const urineAnionGap = {
  id: 'urine-anion-gap',
  category: 'Acid–base',
  title: 'Urine Anion Gap',
  source: 'CAPN Handbook 2021, ch.4',
  formula: 'UAG = urine Na + urine K − urine Cl',
  inputs: [
    { key: 'urineNa', label: 'Urine sodium', unit: 'mmol/L', min: 0, max: 300, step: 1 },
    { key: 'urineK', label: 'Urine potassium', unit: 'mmol/L', min: 0, max: 200, step: 1 },
    { key: 'urineCl', label: 'Urine chloride', unit: 'mmol/L', min: 0, max: 300, step: 1 },
  ],
  compute(v) {
    const na = requireRange(v.urineNa, 0, 300, 'Urine sodium', 'urineNa');
    const k = requireRange(v.urineK, 0, 200, 'Urine potassium', 'urineK');
    const cl = requireRange(v.urineCl, 0, 300, 'Urine chloride', 'urineCl');

    const uag = na + k - cl;
    const steps = [
      step('Sum the urine cations', `${fmt(na)} + ${fmt(k)}`, `${fmt(na + k)} mmol/L`),
      step('Subtract urine chloride', `${fmt(na + k)} − ${fmt(cl)}`, `${fmt(uag)} mmol/L`),
    ];

    const interp = uag < 0
      ? interpret(LEVEL.NORMAL, `Negative UAG (${fmt(uag)} mmol/L) — "neGUTive"`,
        'High urinary ammonium: the kidney is excreting acid appropriately. Points to GI bicarbonate loss (diarrhea, fistula, stoma).')
      : interpret(LEVEL.WARN, `Positive UAG (${fmt(uag)} mmol/L)`,
        'Low urinary ammonium: impaired renal acid excretion. Consistent with renal tubular acidosis.');

    return {
      value: uag, unit: 'mmol/L', label: 'Urine anion gap',
      steps,
      extra: [{ label: 'Urine anion gap', value: fmt(uag), unit: 'mmol/L' }],
      interpretation: interp,
    };
  },
  considerations: [
    'The mnemonic is "neGUTive" — a negative urine anion gap points to the GUT as the source of bicarbonate loss.',
    'The UAG is an indirect estimate of urinary ammonium, which is not measured directly on a standard panel.',
    'It is only valid in a normal-anion-gap metabolic acidosis. It is unreliable when an unmeasured anion is being excreted — DKA (ketones), toluene sniffing, or penicillin therapy — because ammonium leaves with that anion rather than chloride.',
    'The urine osmolal gap is a better ammonium surrogate when the UAG is equivocal or the above confounders are present.',
    'Interpret with the urine pH: a urine pH above 5.5 in the face of systemic acidosis suggests distal RTA.',
  ],
};

export const calculators = [anionGap, compensation, urineAnionGap];
