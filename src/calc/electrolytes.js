/**
 * Sodium, water, potassium and calcium calculations.
 * Formulas and worked examples taken from the CAPN Resident Handbook (2021) ch.4.
 */
'use strict';

import { fmt } from '../fmt.js';
import { step, interpret, LEVEL, requireNumber, requireRange, requirePositive, requireAnalyte, weightWarnings } from '../descriptor.js';

/** Sodium content of common IV fluids, mmol/L. */
export const FLUID_NA = {
  ns: { label: '0.9% NaCl (normal saline)', na: 154 },
  half: { label: '0.45% NaCl', na: 77 },
  third: { label: '0.33% NaCl', na: 51 },
  rl: { label: "Ringer's lactate", na: 130 },
  hypertonic3: { label: '3% NaCl', na: 513 },
  d5w: { label: 'D5W (free water)', na: 0 },
};

export const sodiumDeficit = {
  id: 'sodium-deficit',
  category: 'Electrolytes',
  title: 'Sodium Deficit (hypovolemic hyponatremia)',
  source: 'CAPN Handbook 2021, ch.4 — Hyponatremia',
  formula: 'Na deficit (mmol) = 0.6 × weight (kg) × (desired Na − current Na)',
  inputs: [
    { key: 'weight', label: 'Weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
    { key: 'currentNa', label: 'Current serum sodium', unit: 'mmol/L', min: 90, max: 175, step: 1 },
    { key: 'desiredNa', label: 'Target sodium', unit: 'mmol/L', min: 100, max: 145, step: 1, default: 135 },
    { key: 'hours', label: 'Correct over', unit: 'hr', min: 4, max: 72, step: 1, default: 24 },
    {
      key: 'fluid', label: 'Replacement fluid', type: 'select', default: 'ns',
      options: [
        { value: 'ns', label: '0.9% NaCl — 154 mmol/L' },
        { value: 'rl', label: "Ringer's lactate — 130 mmol/L" },
        { value: 'hypertonic3', label: '3% NaCl — 513 mmol/L' },
      ],
    },
    { key: 'includeMaintenance', label: 'Add maintenance Na (2 mmol/kg/day)', type: 'checkbox', default: true },
  ],
  compute(v) {
    const w = requireRange(v.weight, 0.4, 200, 'Weight', 'weight');
    const cur = requireRange(v.currentNa, 90, 175, 'Current sodium', 'currentNa');
    const target = requireRange(v.desiredNa ?? 135, 100, 145, 'Target sodium', 'desiredNa');
    const hours = requireRange(v.hours ?? 24, 4, 72, 'Correction period', 'hours');
    const fluid = FLUID_NA[v.fluid || 'ns'];
    const warnings = weightWarnings(w);

    if (target <= cur) {
      warnings.push(interpret(LEVEL.WARN, 'Target sodium is not above the current sodium — no deficit to replace.'));
    }

    const delta = target - cur;
    const tbw = 0.6 * w;
    const deficit = tbw * delta;
    const volumeL = deficit / fluid.na;
    const volumeMl = volumeL * 1000;
    const rate = volumeMl / hours;

    const steps = [
      step('Total body water (0.6 × weight)', `0.6 × ${fmt(w, 2)} kg`, `${fmt(tbw, 2)} L`),
      step('Sodium deficit', `${fmt(tbw, 2)} L × (${fmt(target)} − ${fmt(cur)}) mmol/L`, `${fmt(deficit)} mmol`),
      step(`Volume of ${fluid.label}`, `${fmt(deficit)} mmol ÷ ${fluid.na} mmol/L`, `${fmt(volumeMl, 0)} mL`),
      step(`Rate over ${fmt(hours)} hr`, `${fmt(volumeMl, 0)} mL ÷ ${fmt(hours)} hr`, `${fmt(rate)} mL/hr`),
    ];

    const extra = [
      { label: 'Sodium deficit', value: fmt(deficit), unit: 'mmol' },
      { label: `Volume of ${fluid.label}`, value: fmt(volumeMl, 0), unit: 'mL' },
      { label: 'Deficit replacement rate', value: fmt(rate), unit: 'mL/hr' },
    ];

    let totalRate = rate;
    if (v.includeMaintenance !== false) {
      const maintNa = 2 * w;
      const maintVol = (maintNa / fluid.na) * 1000;
      const maintRate = maintVol / 24;
      totalRate = rate + maintRate;
      steps.push(step('Maintenance sodium (2 mmol/kg/day)', `2 × ${fmt(w, 2)} kg`, `${fmt(maintNa)} mmol/day`));
      steps.push(step('As volume of the same fluid', `${fmt(maintNa)} ÷ ${fluid.na} × 1000 ÷ 24 hr`, `${fmt(maintRate)} mL/hr`));
      steps.push(step('Combined rate', `${fmt(rate)} + ${fmt(maintRate)}`, `${fmt(totalRate)} mL/hr`));
      extra.push({ label: 'Maintenance Na', value: fmt(maintNa), unit: 'mmol/day' });
      extra.push({ label: 'Combined rate', value: fmt(totalRate), unit: 'mL/hr' });
    }

    const ratePerDay = (delta / hours) * 24;
    if (ratePerDay > 8) {
      warnings.push(interpret(LEVEL.DANGER,
        `This plan raises sodium by ${fmt(ratePerDay)} mmol/L per 24 hr. Do not exceed 8 mmol/L/24 hr — osmotic demyelination risk. Lengthen the correction period or lower the target.`));
    }
    if (cur < 125) {
      warnings.push(interpret(LEVEL.WARN,
        'Sodium below 125 mmol/L. If seizing or obtunded, give 3% NaCl 2–3 mL/kg over 20 min first, then reassess.'));
    }

    return {
      value: totalRate, unit: 'mL/hr', label: 'Infusion rate',
      steps, extra, warnings,
      interpretation: interpret(LEVEL.INFO,
        `${fmt(deficit)} mmol deficit → ${fmt(totalRate)} mL/hr of ${fluid.label}`,
        `Raises sodium ~${fmt(ratePerDay)} mmol/L per 24 hr.`),
    };
  },
  considerations: [
    'Account for sodium already given in resuscitation boluses — it counts toward the deficit.',
    'Never raise serum sodium by more than 8–10 mmol/L in 24 hours. Aim for 4–6 mmol/L/day in chronic hyponatremia.',
    'A sudden rise in urine output is a warning sign: ADH is being suppressed, free water is being cleared, and sodium may rise faster than planned. Recheck immediately.',
    'Confirm true hypotonic hyponatremia first — check serum osmolality. Normal osmolality suggests hyperproteinemia or hyperlipidemia; high osmolality suggests glucose or mannitol.',
    'This formula addresses hypovolemic hyponatremia. SIADH is treated with fluid restriction (about twice insensible losses), not sodium loading.',
    'No formula is reliable across the whole correction. Recheck sodium every 2–4 hours during active correction and adjust.',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.4.'],
};

export const freeWaterDeficit = {
  id: 'free-water-deficit',
  category: 'Electrolytes',
  title: 'Free Water Deficit (hypernatremia)',
  source: 'CAPN Handbook 2021, ch.4 — Hypernatremia',
  formula: 'FWD (L) = 0.6 × weight (kg) × [(actual Na − desired Na) / desired Na]',
  inputs: [
    { key: 'weight', label: 'Weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
    { key: 'currentNa', label: 'Current serum sodium', unit: 'mmol/L', min: 145, max: 200, step: 1 },
    { key: 'desiredNa', label: 'Target sodium', unit: 'mmol/L', min: 135, max: 160, step: 1, default: 145 },
  ],
  compute(v) {
    const w = requireRange(v.weight, 0.4, 200, 'Weight', 'weight');
    const cur = requireRange(v.currentNa, 130, 200, 'Current sodium', 'currentNa');
    const target = requireRange(v.desiredNa ?? 145, 130, 160, 'Target sodium', 'desiredNa');
    const warnings = weightWarnings(w);

    const tbw = 0.6 * w;
    const ratio = (cur - target) / target;
    const fwdL = tbw * ratio;
    const fwdMl = fwdL * 1000;

    const delta = cur - target;
    const ruleOfThumb = 4 * w * delta;

    const minDays = Math.max(1, delta / 10);
    const perDay = fwdMl / minDays;

    const steps = [
      step('Total body water (0.6 × weight)', `0.6 × ${fmt(w, 2)} kg`, `${fmt(tbw, 2)} L`),
      step('Relative sodium excess', `(${fmt(cur)} − ${fmt(target)}) / ${fmt(target)}`, `${fmt(ratio, 3)}`),
      step('Free water deficit', `${fmt(tbw, 2)} L × ${fmt(ratio, 3)}`, `${fmt(fwdMl, 0)} mL`),
      step('Cross-check (4 mL/kg lowers Na by 1 mmol/L)', `4 × ${fmt(w, 2)} kg × ${fmt(delta)} mmol/L`, `${fmt(ruleOfThumb, 0)} mL`),
      step(`Spread over ${fmt(minDays, 1)} day(s) at ≤10 mmol/L/day`, `${fmt(fwdMl, 0)} mL ÷ ${fmt(minDays, 1)}`, `${fmt(perDay, 0)} mL/day`),
    ];

    if (cur >= 160) {
      warnings.push(interpret(LEVEL.DANGER,
        'Severe hypernatremia. Correct slowly — sodium must not fall faster than 8–10 mmol/L per 24 hours or cerebral edema may result.'));
    }
    warnings.push(interpret(LEVEL.INFO,
      `Restore intravascular volume first: normal saline 20–60 mL/kg = ${fmt(w * 20, 0)}–${fmt(w * 60, 0)} mL.`));

    return {
      value: fwdMl, unit: 'mL', label: 'Free water deficit', decimals: 0,
      steps,
      extra: [
        { label: 'Free water deficit', value: fmt(fwdMl, 0), unit: 'mL' },
        { label: 'Rule-of-thumb cross-check', value: fmt(ruleOfThumb, 0), unit: 'mL' },
        { label: 'Correct over', value: fmt(minDays, 1), unit: 'day(s) minimum' },
        { label: 'Free water per 24 hr', value: fmt(perDay, 0), unit: 'mL/day' },
        { label: 'Sodium to fall by', value: fmt(delta), unit: 'mmol/L total' },
      ],
      warnings,
      interpretation: interpret(LEVEL.INFO,
        `${fmt(fwdMl, 0)} mL free water deficit, replace over ≥${fmt(minDays, 1)} day(s)`),
    };
  },
  considerations: [
    'This is free water only. The final prescription is insensible losses + this deficit + ongoing losses.',
    'Sodium must not fall faster than 8–10 mmol/L per 24 hours. The brain generates idiogenic osmoles in hypernatremia; correcting faster causes cerebral edema.',
    'Restore circulation with normal saline before starting free water replacement — perfusion comes first.',
    'Replace urine output mL:mL. Start with normal saline until a urine sodium is available, so the serum sodium is not dropped too quickly.',
    'The enteral route is more physiologic than IV for free water when there is no contraindication.',
    'Recheck sodium every 2–4 hours initially. If it is falling too fast, increase the sodium content of the replacement fluid.',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.4.'],
};

export const serumOsmolality = {
  id: 'serum-osmolality',
  category: 'Electrolytes',
  title: 'Serum Osmolality & Osmolal Gap',
  source: 'Standard; SI form per CAPN Handbook ch.4',
  formula: 'Calculated osmolality = 2 × Na + glucose + urea   (all mmol/L)',
  inputs: [
    { key: 'sodium', label: 'Sodium', unit: 'mmol/L', min: 90, max: 200, step: 1 },
    { key: 'glucose', label: 'Glucose', unit: 'mmol/L', min: 0, max: 100, step: 0.1, analyte: 'glucose' },
    { key: 'urea', label: 'Urea', unit: 'mmol/L', min: 0, max: 100, step: 0.1, analyte: 'urea' },
    { key: 'measured', label: 'Measured osmolality', unit: 'mOsm/kg', min: 200, max: 400, step: 1, optional: true },
  ],
  compute(v) {
    const na = requireRange(v.sodium, 90, 200, 'Sodium', 'sodium');
    const glu = requireAnalyte('glucose', v.glucose, v.glucoseUnit, 0, 100, 'Glucose', 'glucose').value;
    const urea = requireAnalyte('urea', v.urea, v.ureaUnit, 0, 100, 'Urea', 'urea').value;

    const calc = 2 * na + glu + urea;
    const steps = [
      step('Double the sodium (accounts for accompanying anions)', `2 × ${fmt(na)}`, `${fmt(2 * na)} mmol/L`),
      step('Add glucose and urea', `${fmt(2 * na)} + ${fmt(glu, 1)} + ${fmt(urea, 1)}`, `${fmt(calc, 1)} mOsm/kg`),
    ];

    const extra = [{ label: 'Calculated osmolality', value: fmt(calc, 1), unit: 'mOsm/kg' }];
    const warnings = [];
    let gap = null;

    if (v.measured) {
      const meas = requireRange(v.measured, 200, 400, 'Measured osmolality', 'measured');
      gap = meas - calc;
      steps.push(step('Osmolal gap', `${fmt(meas)} − ${fmt(calc, 1)}`, `${fmt(gap, 1)} mOsm/kg`));
      extra.push({ label: 'Osmolal gap', value: fmt(gap, 1), unit: 'mOsm/kg' });
      if (gap > 10) {
        warnings.push(interpret(LEVEL.DANGER,
          `Osmolal gap ${fmt(gap, 1)} mOsm/kg (normal <10). Consider methanol, ethylene glycol, ethanol, isopropanol, mannitol, or glycine.`));
      }
    }

    let interp;
    if (calc < 275) interp = interpret(LEVEL.WARN, `Hypo-osmolar (${fmt(calc, 1)} mOsm/kg) — consistent with true hypotonic hyponatremia`);
    else if (calc > 295) interp = interpret(LEVEL.WARN, `Hyperosmolar (${fmt(calc, 1)} mOsm/kg)`);
    else interp = interpret(LEVEL.NORMAL, `Normal (${fmt(calc, 1)} mOsm/kg)`);

    return { value: calc, unit: 'mOsm/kg', label: 'Calculated osmolality', steps, extra, warnings, interpretation: interp };
  },
  considerations: [
    'In hyponatremia this is the first branch point: low osmolality is true hyponatremia; normal suggests hyperproteinemia or hyperlipidemia; high suggests glucose or mannitol.',
    'Urea crosses cell membranes freely, so it contributes to measured osmolality but not to effective tonicity. For tonicity, use 2 × Na + glucose.',
    'SIADH is characterised by plasma osmolality <270 mOsm/kg with urine osmolality >100 mOsm/kg.',
    'An osmolal gap above 10 mOsm/kg suggests an unmeasured osmole and warrants a toxicology work-up.',
  ],
};

export const correctedCalcium = {
  id: 'corrected-calcium',
  category: 'Electrolytes',
  title: 'Albumin-Corrected Calcium',
  source: 'Payne RB, BMJ 1973 (SI form)',
  formula: 'Corrected Ca (mmol/L) = measured Ca + 0.02 × (40 − albumin g/L)',
  inputs: [
    { key: 'calcium', label: 'Total calcium', unit: 'mmol/L', min: 1, max: 5, step: 0.01, analyte: 'calcium' },
    { key: 'albumin', label: 'Albumin', unit: 'g/L', min: 5, max: 60, step: 1, analyte: 'albumin' },
  ],
  compute(v) {
    const ca = requireAnalyte('calcium', v.calcium, v.calciumUnit, 0.5, 6, 'Calcium', 'calcium').value;
    const alb = requireAnalyte('albumin', v.albumin, v.albuminUnit, 3, 70, 'Albumin', 'albumin').value;

    const adjust = 0.02 * (40 - alb);
    const corrected = ca + adjust;

    const warnings = [];
    if (alb >= 40) {
      warnings.push(interpret(LEVEL.INFO, 'Albumin is normal — no correction is needed; the measured calcium stands.'));
    }

    let interp;
    if (corrected < 2.1) interp = interpret(LEVEL.WARN, `Hypocalcemia (${fmt(corrected, 2)} mmol/L)`);
    else if (corrected > 2.6) interp = interpret(LEVEL.WARN, `Hypercalcemia (${fmt(corrected, 2)} mmol/L)`);
    else interp = interpret(LEVEL.NORMAL, `Normal (${fmt(corrected, 2)} mmol/L)`);

    return {
      value: corrected, unit: 'mmol/L', label: 'Corrected calcium', decimals: 2,
      steps: [
        step('Albumin shortfall from 40 g/L', `40 − ${fmt(alb)}`, `${fmt(40 - alb)} g/L`),
        step('Correction (0.02 mmol/L per g/L)', `0.02 × ${fmt(40 - alb)}`, `${fmt(adjust, 2)} mmol/L`),
        step('Add to measured calcium', `${fmt(ca, 2)} + ${fmt(adjust, 2)}`, `${fmt(corrected, 2)} mmol/L`),
      ],
      extra: [
        { label: 'Measured calcium', value: fmt(ca, 2), unit: 'mmol/L' },
        { label: 'Correction applied', value: fmt(adjust, 2), unit: 'mmol/L' },
      ],
      warnings, interpretation: interp,
    };
  },
  considerations: [
    'Ionized calcium is the definitive measurement. This correction is an estimate and performs poorly in critical illness, CKD, and acid-base disturbance — measure ionized calcium when the answer matters.',
    'pH shifts ionized calcium independently of albumin: acidemia raises it, alkalemia lowers it. In a child who is both acidemic and hypocalcemic, correct the calcium BEFORE the acidemia, or ionized calcium will fall.',
    'The correction is only meaningful when albumin is below normal.',
    'In CKD-MBD, interpret calcium alongside phosphate, PTH, and alkaline phosphatase, never alone.',
  ],
};

export const ttkg = {
  id: 'ttkg',
  category: 'Electrolytes',
  title: 'Transtubular Potassium Gradient & Urine K/Cr',
  source: 'CAPN Handbook 2021, ch.4 — Hyperkalemia/Hypokalemia',
  formula: 'TTKG = (urine K / plasma K) × (plasma osmolality / urine osmolality)',
  inputs: [
    { key: 'urineK', label: 'Urine potassium', unit: 'mmol/L', min: 0, max: 200, step: 0.1 },
    { key: 'plasmaK', label: 'Plasma potassium', unit: 'mmol/L', min: 1, max: 10, step: 0.1 },
    { key: 'urineOsm', label: 'Urine osmolality', unit: 'mOsm/kg', min: 50, max: 1400, step: 1 },
    { key: 'plasmaOsm', label: 'Plasma osmolality', unit: 'mOsm/kg', min: 200, max: 400, step: 1 },
    { key: 'urineNa', label: 'Urine sodium (validity check)', unit: 'mmol/L', min: 0, max: 300, step: 1, optional: true },
    { key: 'urineCr', label: 'Urine creatinine (for K/Cr ratio)', unit: 'mmol/L', min: 0, max: 100, step: 0.1, optional: true },
  ],
  compute(v) {
    const uk = requireRange(v.urineK, 0, 200, 'Urine potassium', 'urineK');
    const pk = requireRange(v.plasmaK, 1, 10, 'Plasma potassium', 'plasmaK');
    const uosm = requireRange(v.urineOsm, 50, 1400, 'Urine osmolality', 'urineOsm');
    const posm = requireRange(v.plasmaOsm, 200, 400, 'Plasma osmolality', 'plasmaOsm');

    const kRatio = uk / pk;
    const osmRatio = posm / uosm;
    const value = kRatio * osmRatio;

    const steps = [
      step('Urine-to-plasma potassium ratio', `${fmt(uk, 1)} / ${fmt(pk, 1)}`, `${fmt(kRatio, 2)}`),
      step('Correct for water reabsorption', `${fmt(posm)} / ${fmt(uosm)}`, `${fmt(osmRatio, 2)}`),
      step('Multiply', `${fmt(kRatio, 2)} × ${fmt(osmRatio, 2)}`, `${fmt(value, 1)}`),
    ];

    const warnings = [];
    if (uosm <= posm) {
      warnings.push(interpret(LEVEL.DANGER,
        `TTKG is INVALID here: urine osmolality (${fmt(uosm)}) must exceed plasma osmolality (${fmt(posm)}).`));
    }
    if (v.urineNa !== undefined && v.urineNa !== '' && Number(v.urineNa) < 20) {
      warnings.push(interpret(LEVEL.DANGER,
        `TTKG is INVALID here: urine sodium ${fmt(Number(v.urineNa))} mmol/L is below the required 20 mmol/L (insufficient distal delivery).`));
    }

    const extra = [{ label: 'TTKG', value: fmt(value, 1), unit: '' }];
    if (v.urineCr) {
      const ucr = requireRange(v.urineCr, 0.1, 100, 'Urine creatinine', 'urineCr');
      const kcr = uk / ucr;
      extra.push({ label: 'Urine K/creatinine', value: fmt(kcr, 1), unit: 'mmol/mmol' });
      steps.push(step('Urine K/creatinine ratio (preferred alternative)', `${fmt(uk, 1)} / ${fmt(ucr, 1)}`, `${fmt(kcr, 1)} mmol/mmol`));
      if (pk < 3.5 && kcr > 1.5) {
        warnings.push(interpret(LEVEL.WARN, `Hypokalemia with K/Cr ${fmt(kcr, 1)} (>1.5) indicates renal potassium wasting.`));
      }
      if (pk > 5.5 && kcr < 20) {
        warnings.push(interpret(LEVEL.WARN, `Hyperkalemia with K/Cr ${fmt(kcr, 1)} (<20) indicates inadequate renal potassium excretion.`));
      }
    }

    const interp = value < 6
      ? interpret(LEVEL.WARN, `TTKG ${fmt(value, 1)} — impaired aldosterone bioactivity`)
      : interpret(LEVEL.NORMAL, `TTKG ${fmt(value, 1)} — renal potassium handling intact`);

    return { value, unit: '', label: 'TTKG', decimals: 1, steps, extra, warnings, interpretation: interp };
  },
  considerations: [
    'TTKG is only interpretable when urine osmolality exceeds plasma osmolality AND urine sodium is above 20 mmol/L. Outside those conditions the number is meaningless.',
    'The handbook notes the formula\'s validity is questioned because of urea recycling in the medullary collecting duct — the original authors themselves retracted it — though it remains in common use.',
    'The urine potassium/creatinine ratio is the preferred alternative: below 1.5 mmol/mmol in hypokalemia indicates appropriate renal conservation; above 20 in hyperkalemia indicates appropriate excretion.',
    'Interpret alongside acid-base status, blood pressure, and volume state — TTKG alone does not diagnose anything.',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.4.'],
};

export const hyperkalemiaDosing = {
  id: 'hyperkalemia-dosing',
  category: 'Electrolytes',
  title: 'Hyperkalemia — Emergency Dosing',
  source: 'CAPN Handbook 2021, ch.4 — Hyperkalemia',
  formula: 'Weight-based emergency doses: stabilise the membrane, shift potassium in, then remove it.',
  inputs: [
    { key: 'weight', label: 'Weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
    { key: 'potassium', label: 'Serum potassium', unit: 'mmol/L', min: 3, max: 12, step: 0.1, optional: true },
    { key: 'acidotic', label: 'Acidotic', type: 'checkbox', default: false },
  ],
  compute(v) {
    const w = requireRange(v.weight, 0.4, 200, 'Weight', 'weight');
    const warnings = weightWarnings(w);

    const caGlucLow = Math.min(50 * w, 2000);
    const caGlucHigh = Math.min(100 * w, 2000);
    const caGlucMlLow = caGlucLow / 100;
    const caGlucMlHigh = caGlucHigh / 100;
    const insulin = 0.1 * w;
    const glucoseLow = 0.5 * w;
    const glucoseHigh = 1.0 * w;
    const bicarb = Math.min(1 * w, 50);
    const furosemide = 1 * w;
    const salbutamol = w < 25 ? 2.5 : 5;

    const steps = [
      step('Calcium gluconate 10% — 50–100 mg/kg (max 2000 mg)',
        `${fmt(w, 2)} kg × 50–100 mg/kg`,
        `${fmt(caGlucLow, 0)}–${fmt(caGlucHigh, 0)} mg = ${fmt(caGlucMlLow, 1)}–${fmt(caGlucMlHigh, 1)} mL`),
      step('Insulin (regular) 0.1 units/kg', `${fmt(w, 2)} × 0.1`, `${fmt(insulin, 1)} units`),
      step('Dextrose 0.5–1 g/kg with the insulin', `${fmt(w, 2)} × 0.5–1`, `${fmt(glucoseLow, 1)}–${fmt(glucoseHigh, 1)} g`),
      step('Salbutamol nebulised', w < 25 ? 'under 25 kg' : '25 kg and over', `${salbutamol} mg`),
      step('Furosemide 1 mg/kg IV', `${fmt(w, 2)} × 1`, `${fmt(furosemide, 1)} mg`),
    ];
    if (v.acidotic) {
      steps.push(step('Sodium bicarbonate 1 mmol/kg (max 50 mmol)', `${fmt(w, 2)} × 1`, `${fmt(bicarb, 1)} mmol`));
    }

    const extra = [
      { label: 'Calcium gluconate 10%', value: `${fmt(caGlucMlLow, 1)}–${fmt(caGlucMlHigh, 1)}`, unit: 'mL IV over 5–10 min' },
      { label: 'Insulin (regular)', value: fmt(insulin, 1), unit: 'units IV' },
      { label: 'Dextrose', value: `${fmt(glucoseLow, 1)}–${fmt(glucoseHigh, 1)}`, unit: 'g IV' },
      { label: 'Salbutamol neb', value: `${salbutamol}`, unit: 'mg' },
      { label: 'Furosemide', value: fmt(furosemide, 1), unit: 'mg IV' },
      { label: 'Sodium bicarbonate (if acidotic)', value: fmt(bicarb, 1), unit: 'mmol IV' },
    ];

    if (v.potassium) {
      const k = requireRange(v.potassium, 3, 12, 'Serum potassium', 'potassium');
      if (k >= 7) {
        warnings.push(interpret(LEVEL.DANGER, `Potassium ${fmt(k, 1)} mmol/L — treat immediately, get an ECG, and call for dialysis support.`));
      } else if (k >= 6) {
        warnings.push(interpret(LEVEL.WARN, `Potassium ${fmt(k, 1)} mmol/L — obtain an ECG and begin treatment.`));
      }
    }

    return {
      value: caGlucMlHigh, unit: 'mL', label: 'Calcium gluconate 10% (upper dose)', decimals: 1,
      steps, extra, warnings,
      interpretation: interpret(LEVEL.DANGER, 'Stabilise → shift → remove', 'Calcium first if there are ECG changes; it does not lower potassium but protects the myocardium.'),
    };
  },
  considerations: [
    'Calcium stabilises the cardiac membrane but does NOT lower serum potassium. Always follow it with shifting agents.',
    'Insulin must be given with dextrose, and glucose must be monitored for at least 6 hours afterwards — post-treatment hypoglycemia is a common and avoidable harm.',
    'Shifting agents are temporary. Potassium re-emerges from cells; definitive removal means diuresis, binders, or dialysis.',
    'Confirm the value is real before treating aggressively — hemolysed samples and heel-prick specimens frequently give spurious hyperkalemia. Repeat on a free-flowing sample if the child is well and the ECG is normal.',
    'Salbutamol dosing above is the nebulised route; repeat dosing may be needed.',
    'Stop all potassium intake, and review medications (ACE inhibitors, ARBs, potassium-sparing diuretics, trimethoprim, heparin).',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.4.'],
};

export const calculators = [
  sodiumDeficit, freeWaterDeficit, serumOsmolality, correctedCalcium, ttkg, hyperkalemiaDosing,
];
