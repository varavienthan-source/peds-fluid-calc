/**
 * Estimated GFR and CKD staging.
 *
 * The handbook states the bedside Schwartz equation in its SI form directly:
 *   eGFR = 36.5 x height(cm) / Cr(umol/L)
 * This is the same equation as the familiar 0.413 x height/SCr(mg/dL), with the
 * 88.4 unit conversion folded into the constant (0.413 x 88.4 = 36.5).
 */
'use strict';

import { fmt } from '../fmt.js';
import { step, interpret, LEVEL, requireNumber, requireRange, requireAnalyte } from '../descriptor.js';

/** KDIGO GFR category for an eGFR in mL/min/1.73m^2. */
export function ckdStage(egfr) {
  if (egfr >= 90) return { stage: 'G1', text: 'Normal or high', level: LEVEL.NORMAL };
  if (egfr >= 60) return { stage: 'G2', text: 'Mildly decreased', level: LEVEL.INFO };
  if (egfr >= 45) return { stage: 'G3a', text: 'Mildly to moderately decreased', level: LEVEL.WARN };
  if (egfr >= 30) return { stage: 'G3b', text: 'Moderately to severely decreased', level: LEVEL.WARN };
  if (egfr >= 15) return { stage: 'G4', text: 'Severely decreased', level: LEVEL.DANGER };
  return { stage: 'G5', text: 'Kidney failure', level: LEVEL.DANGER };
}

/** Bedside Schwartz, SI native. height in cm, creatinine in umol/L. */
export function schwartzSI(heightCm, creatinineUmol) {
  return (36.5 * heightCm) / creatinineUmol;
}

/** CKiD U25 k coefficient (Pierce 2021). age in years. */
export function ckidU25K(ageYears, sex) {
  const a = ageYears;
  if (sex === 'female') {
    if (a < 12) return 36.1 * Math.pow(1.008, a - 12);
    if (a < 18) return 36.1 * Math.pow(1.023, a - 12);
    return 41.4;
  }
  if (a < 12) return 39.0 * Math.pow(1.008, a - 12);
  if (a < 18) return 39.0 * Math.pow(1.045, a - 12);
  return 50.8;
}

export const bedsideSchwartz = {
  id: 'egfr-schwartz',
  category: 'Kidney function',
  title: 'Bedside Schwartz eGFR',
  source: 'CAPN Handbook 2021, ch.2 (p.14) and ch.5 (p.50) · Schwartz JASN 2009',
  formula: 'eGFR = 36.5 × height(cm) / creatinine(µmol/L)',
  inputs: [
    { key: 'height', label: 'Height / length', unit: 'cm', min: 20, max: 220, step: 0.1 },
    { key: 'creatinine', label: 'Serum creatinine', unit: 'µmol/L', min: 5, max: 2000, step: 1, analyte: 'creatinine' },
    { key: 'age', label: 'Age (for validity checks)', unit: 'years', min: 0, max: 25, step: 0.1, optional: true },
  ],
  compute(v) {
    const h = requireRange(v.height, 20, 220, 'Height', 'height');
    const cr = requireAnalyte('creatinine', v.creatinine, v.creatinineUnit, 1, 3000, 'Creatinine', 'creatinine');

    const steps = [];
    if (cr.converted) {
      steps.push(step('Convert creatinine to SI', `${fmt(cr.from.value, 2)} mg/dL × 88.4`, `${fmt(cr.value)} µmol/L`));
    }
    const egfr = schwartzSI(h, cr.value);
    steps.push(step('Apply bedside Schwartz (SI form)', `36.5 × ${fmt(h)} cm ÷ ${fmt(cr.value)} µmol/L`, `${fmt(egfr)} mL/min/1.73m²`));

    const stage = ckdStage(egfr);
    const warnings = [];
    if (v.age !== undefined && v.age !== '') {
      const age = requireRange(v.age, 0, 30, 'Age', 'age');
      if (age < 1) {
        warnings.push(interpret(LEVEL.DANGER,
          'Under 1 year of age this equation is not valid. Normal GFR is physiologically low in infancy (~20 mL/min/1.73m² at term birth, rising to adult values by about 2 years) — interpret creatinine against age-specific norms instead.'));
      } else if (age >= 18) {
        warnings.push(interpret(LEVEL.WARN,
          'At 18 years and over, prefer CKiD U25 (validated to 25 years) or CKD-EPI 2021 for the transition to adult care.'));
      }
    }
    if (egfr < 15) {
      warnings.push(interpret(LEVEL.DANGER, 'eGFR below 15 — kidney failure range. In severe AKI the handbook advises assuming GFR <10 rather than relying on a steady-state equation.'));
    }
    if (egfr < 50) {
      warnings.push(interpret(LEVEL.WARN, 'Below 50 mL/min/1.73m² — review all renally excreted drugs for dose adjustment.'));
    }

    return {
      value: egfr, unit: 'mL/min/1.73m²', label: 'Estimated GFR',
      steps,
      extra: [
        { label: 'KDIGO GFR category', value: stage.stage, unit: stage.text },
        { label: 'Creatinine used', value: fmt(cr.value), unit: 'µmol/L' },
      ],
      warnings,
      interpretation: interpret(stage.level, `${fmt(egfr)} mL/min/1.73m² — ${stage.stage} (${stage.text})`),
    };
  },
  considerations: [
    'The handbook gives this equation directly in SI units — no mg/dL conversion is needed when working from a Canadian lab report.',
    'Derived in children with CKD, so it overestimates GFR when kidney function is normal.',
    'Validated roughly ages 1–16 years. Below 1 year it does not apply; above 18, use CKiD U25 or CKD-EPI.',
    'Assumes an enzymatic, IDMS-traceable creatinine assay. Older Jaffe methods read differently and will bias the result.',
    'It assumes steady state. In evolving AKI the creatinine lags behind the true GFR, so eGFR overestimates function — the handbook advises assuming GFR <10 in severe AKI.',
    'Unreliable at extremes of muscle mass: malnutrition, amputation, spina bifida, neurogenic bladder, or severe growth failure. Consider a cystatin C-based estimate or a measured clearance instead.',
    'Height must be measured accurately — the result scales linearly with it.',
  ],
  references: [
    'Schwartz GJ et al. New equations to estimate GFR in children with CKD. J Am Soc Nephrol 2009;20:629-37.',
    'CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021.',
  ],
};

export const ckidU25 = {
  id: 'egfr-ckid-u25',
  category: 'Kidney function',
  title: 'CKiD U25 eGFR (creatinine)',
  source: 'Pierce CB et al. Kidney Int 2021;99:948-56',
  formula: 'eGFR = k × height(m) / creatinine(mg/dL), where k depends on age and sex',
  inputs: [
    { key: 'height', label: 'Height / length', unit: 'cm', min: 40, max: 220, step: 0.1 },
    { key: 'creatinine', label: 'Serum creatinine', unit: 'µmol/L', min: 5, max: 2000, step: 1, analyte: 'creatinine' },
    { key: 'age', label: 'Age', unit: 'years', min: 1, max: 25, step: 0.1 },
    {
      key: 'sex', label: 'Sex', type: 'select', default: 'male',
      options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }],
    },
  ],
  compute(v) {
    const h = requireRange(v.height, 40, 220, 'Height', 'height');
    const age = requireRange(v.age, 1, 25, 'Age', 'age');
    const sex = v.sex || 'male';
    const cr = requireAnalyte('creatinine', v.creatinine, v.creatinineUnit, 1, 3000, 'Creatinine', 'creatinine');

    const crMgDl = cr.value / 88.4;
    const heightM = h / 100;
    const k = ckidU25K(age, sex);
    const egfr = (k * heightM) / crMgDl;

    const band = age < 12 ? '1–11 y' : age < 18 ? '12–17 y' : '18–25 y';
    const kExpr = sex === 'female'
      ? (age < 12 ? `36.1 × 1.008^(${fmt(age, 1)} − 12)` : age < 18 ? `36.1 × 1.023^(${fmt(age, 1)} − 12)` : '41.4 (constant)')
      : (age < 12 ? `39.0 × 1.008^(${fmt(age, 1)} − 12)` : age < 18 ? `39.0 × 1.045^(${fmt(age, 1)} − 12)` : '50.8 (constant)');

    const steps = [
      step('Convert creatinine to mg/dL', `${fmt(cr.value)} µmol/L ÷ 88.4`, `${fmt(crMgDl, 3)} mg/dL`),
      step('Convert height to metres', `${fmt(h)} cm ÷ 100`, `${fmt(heightM, 3)} m`),
      step(`Age- and sex-specific k (${sex}, ${band})`, kExpr, `${fmt(k, 2)}`),
      step('Apply CKiD U25', `${fmt(k, 2)} × ${fmt(heightM, 3)} ÷ ${fmt(crMgDl, 3)}`, `${fmt(egfr)} mL/min/1.73m²`),
    ];

    const stage = ckdStage(egfr);
    const schwartz = schwartzSI(h, cr.value);
    const warnings = [];
    if (Math.abs(schwartz - egfr) / egfr > 0.2) {
      warnings.push(interpret(LEVEL.INFO,
        `Bedside Schwartz gives ${fmt(schwartz)} mL/min/1.73m² for the same inputs — a difference of ${fmt(Math.abs(schwartz - egfr) / egfr * 100)}%. CKiD U25 is generally the more accurate of the two in CKD.`));
    }

    return {
      value: egfr, unit: 'mL/min/1.73m²', label: 'Estimated GFR',
      steps,
      extra: [
        { label: 'KDIGO GFR category', value: stage.stage, unit: stage.text },
        { label: 'k coefficient', value: fmt(k, 2), unit: `${sex}, ${band}` },
        { label: 'Bedside Schwartz for comparison', value: fmt(schwartz), unit: 'mL/min/1.73m²' },
      ],
      warnings,
      interpretation: interpret(stage.level, `${fmt(egfr)} mL/min/1.73m² — ${stage.stage} (${stage.text})`),
    };
  },
  considerations: [
    'Validated ages 1–25, which makes it the equation of choice through the adolescent-to-adult transition, where paediatric and adult equations otherwise disagree sharply.',
    'Developed in the CKiD cohort against iohexol-measured GFR; it outperformed eleven other published equations on internal validation.',
    'The k coefficient changes at age 12 and again at 18. Small age errors near those boundaries shift the result — check the age is right.',
    'Like bedside Schwartz, it is derived in CKD and assumes steady-state creatinine and IDMS-traceable assay.',
    'Cystatin C and combined creatinine–cystatin C variants exist and are more accurate again. They are not implemented here because published secondary sources disagree on the coefficients — they will be added from the primary paper or the handbook rather than guessed.',
  ],
  references: ['Pierce CB, Muñoz A, Ng DK et al. Age- and sex-dependent clinical equations to estimate GFR in children and young adults with CKD. Kidney Int 2021;99:948-56.'],
};

export const creatinineClearance = {
  id: 'creatinine-clearance',
  category: 'Kidney function',
  title: 'Measured Creatinine Clearance (timed urine)',
  source: 'CAPN Handbook 2021, ch.2 — surrogate for GFR',
  formula: 'CrCl = (urine Cr × urine volume) / (plasma Cr × time), normalised to 1.73 m²',
  inputs: [
    { key: 'urineCr', label: 'Urine creatinine', unit: 'µmol/L', min: 100, max: 100000, step: 1 },
    { key: 'urineVolume', label: 'Urine volume collected', unit: 'mL', min: 1, max: 20000, step: 1 },
    { key: 'hours', label: 'Collection period', unit: 'hr', min: 1, max: 48, step: 0.5, default: 24 },
    { key: 'plasmaCr', label: 'Plasma creatinine', unit: 'µmol/L', min: 5, max: 3000, step: 1, analyte: 'creatinine' },
    { key: 'bsa', label: 'Body surface area', unit: 'm²', min: 0.1, max: 3, step: 0.01 },
  ],
  compute(v) {
    const ucr = requireRange(v.urineCr, 100, 100000, 'Urine creatinine', 'urineCr');
    const vol = requireRange(v.urineVolume, 1, 20000, 'Urine volume', 'urineVolume');
    const hours = requireRange(v.hours ?? 24, 1, 48, 'Collection period', 'hours');
    const bsa = requireRange(v.bsa, 0.1, 3, 'Body surface area', 'bsa');
    const pcr = requireAnalyte('creatinine', v.plasmaCr, v.plasmaCrUnit, 1, 3000, 'Plasma creatinine', 'plasmaCr');

    const minutes = hours * 60;
    const rawMlMin = (ucr * vol) / (pcr.value * minutes);
    const normalised = rawMlMin * (1.73 / bsa);

    const steps = [
      step('Total creatinine excreted', `${fmt(ucr)} µmol/L × ${fmt(vol, 0)} mL ÷ 1000`, `${fmt((ucr * vol) / 1000, 1)} µmol`),
      step('Collection period in minutes', `${fmt(hours)} hr × 60`, `${fmt(minutes, 0)} min`),
      step('Clearance', `(${fmt(ucr)} × ${fmt(vol, 0)}) ÷ (${fmt(pcr.value)} × ${fmt(minutes, 0)})`, `${fmt(rawMlMin)} mL/min`),
      step('Normalise to 1.73 m²', `${fmt(rawMlMin)} × 1.73 ÷ ${fmt(bsa, 2)}`, `${fmt(normalised)} mL/min/1.73m²`),
    ];

    const stage = ckdStage(normalised);
    return {
      value: normalised, unit: 'mL/min/1.73m²', label: 'Creatinine clearance',
      steps,
      extra: [
        { label: 'Uncorrected clearance', value: fmt(rawMlMin), unit: 'mL/min' },
        { label: 'KDIGO GFR category', value: stage.stage, unit: stage.text },
      ],
      interpretation: interpret(stage.level, `${fmt(normalised)} mL/min/1.73m² — ${stage.stage} (${stage.text})`),
    };
  },
  considerations: [
    'Creatinine clearance overestimates true GFR because creatinine is secreted by the proximal tubule as well as filtered. The overestimate widens as GFR falls.',
    'Accuracy depends entirely on a complete collection. An incomplete collection is the most common cause of a spuriously low result — check that total creatinine excretion is plausible for the child\'s muscle mass.',
    'Useful precisely where the estimating equations fail: under 1 year, extremes of muscle mass, amputees, neurogenic bladder, and severe growth failure.',
    'Inulin clearance remains the gold standard; iohexol plasma disappearance is the practical research alternative.',
  ],
};

export const calculators = [bedsideSchwartz, ckidU25, creatinineClearance];
