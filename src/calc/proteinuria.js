/**
 * Proteinuria quantification. All thresholds are the SI (mg/mmol) values used by
 * Canadian laboratories, taken from the CAPN Resident Handbook (2021) ch.2 & ch.6.
 * These are NOT interchangeable with the US mg/g or mg/mg figures.
 */
'use strict';

import { fmt } from '../fmt.js';
import { step, interpret, LEVEL, requireRange, requireNumber, requireAnalyte } from '../descriptor.js';
import { bsaMosteller } from './growth.js';

export const proteinCreatinineRatio = {
  id: 'urine-pcr',
  category: 'Proteinuria',
  title: 'Urine Protein/Creatinine Ratio',
  source: 'CAPN Handbook 2021, ch.2 (p.16) and ch.6',
  formula: 'PCR = urine protein (mg/L) / urine creatinine (mmol/L)   →   mg/mmol',
  inputs: [
    {
      key: 'mode', label: 'Entry', type: 'select', default: 'ratio',
      options: [
        { value: 'ratio', label: 'I have the ratio' },
        { value: 'components', label: 'Calculate from protein and creatinine' },
      ],
    },
    { key: 'ratio', label: 'Protein/creatinine ratio', unit: 'mg/mmol', min: 0, max: 3000, step: 0.1, optional: true, analyte: 'proteinCr' },
    { key: 'protein', label: 'Urine protein', unit: 'mg/L', min: 0, max: 50000, step: 1, optional: true },
    { key: 'creatinine', label: 'Urine creatinine', unit: 'mmol/L', min: 0.1, max: 100, step: 0.1, optional: true },
    { key: 'age', label: 'Age', unit: 'years', min: 0, max: 25, step: 0.1 },
  ],
  compute(v) {
    const age = requireRange(v.age, 0, 30, 'Age', 'age');
    const steps = [];
    let pcr;

    if (v.mode === 'components') {
      const prot = requireRange(v.protein, 0, 50000, 'Urine protein', 'protein');
      const cr = requireRange(v.creatinine, 0.01, 100, 'Urine creatinine', 'creatinine');
      pcr = prot / cr;
      steps.push(step('Divide protein by creatinine', `${fmt(prot, 0)} mg/L ÷ ${fmt(cr, 2)} mmol/L`, `${fmt(pcr, 1)} mg/mmol`));
    } else {
      const n = requireAnalyte('proteinCr', v.ratio, v.ratioUnit, 0, 3000, 'Protein/creatinine ratio', 'ratio');
      if (n.converted) {
        steps.push(step('Convert to SI', `${fmt(n.from.value, 0)} mg/g ÷ 8.84`, `${fmt(n.value, 1)} mg/mmol`));
      }
      pcr = n.value;
    }

    const normalCut = age < 2 ? 50 : 20;
    const nephroticCut = 250;
    steps.push(step(`Normal threshold for age ${fmt(age, 1)} y`,
      age < 2 ? 'under 2 years' : '2 years and over', `< ${normalCut} mg/mmol`));
    steps.push(step('Compare', `${fmt(pcr, 1)} vs ${normalCut} / ${nephroticCut}`,
      pcr >= nephroticCut ? 'nephrotic range' : pcr >= normalCut ? 'abnormal' : 'normal'));

    let interp;
    if (pcr >= nephroticCut) {
      interp = interpret(LEVEL.DANGER, `${fmt(pcr, 1)} mg/mmol — nephrotic range`,
        'Above 250 mg/mmol. Look for hypoalbuminemia and edema to complete the nephrotic syndrome picture.');
    } else if (pcr >= normalCut) {
      interp = interpret(LEVEL.WARN, `${fmt(pcr, 1)} mg/mmol — abnormal proteinuria`,
        `Above the age-specific normal of ${normalCut} mg/mmol.`);
    } else {
      interp = interpret(LEVEL.NORMAL, `${fmt(pcr, 1)} mg/mmol — normal`,
        `Below the age-specific normal of ${normalCut} mg/mmol.`);
    }

    return {
      value: pcr, unit: 'mg/mmol', label: 'Protein/creatinine ratio', decimals: 1,
      steps,
      extra: [
        { label: 'PCR', value: fmt(pcr, 1), unit: 'mg/mmol' },
        { label: 'In US units', value: fmt(pcr * 8.84, 0), unit: 'mg/g' },
        { label: 'Age-specific normal', value: `< ${normalCut}`, unit: 'mg/mmol' },
        { label: 'Nephrotic threshold', value: `> ${nephroticCut}`, unit: 'mg/mmol' },
      ],
      interpretation: interp,
    };
  },
  considerations: [
    'CHECK YOUR UNITS. Canadian labs report mg/mmol; US literature reports mg/g or mg/mg. The nephrotic threshold is 250 mg/mmol, which is about 2200 mg/g or 2.2 mg/mg — confusing the two is a factor-of-nine error.',
    'Some Canadian centres report g/mmol instead, where the nephrotic threshold is 0.2 g/mmol. Read the report header before interpreting.',
    'A first-morning sample is preferred — it excludes orthostatic proteinuria, which is benign and common in adolescents.',
    'Transient proteinuria follows fever above 38.3°C, exercise, dehydration, cold exposure, and stress. Repeat before investigating.',
    'PCR captures both glomerular and tubular protein. Pairing it with ACR helps separate the two, since albumin is predominantly glomerular.',
    'Dipstick measures mainly albumin and can miss purely tubular proteinuria (low molecular weight proteins) entirely.',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.2 & ch.6.'],
};

export const albuminCreatinineRatio = {
  id: 'urine-acr',
  category: 'Proteinuria',
  title: 'Urine Albumin/Creatinine Ratio',
  source: 'CAPN Handbook 2021, ch.2 (p.16)',
  formula: 'ACR = urine albumin (mg/L) / urine creatinine (mmol/L)   →   mg/mmol',
  inputs: [
    { key: 'ratio', label: 'Albumin/creatinine ratio', unit: 'mg/mmol', min: 0, max: 3000, step: 0.1, analyte: 'albuminCr' },
  ],
  compute(v) {
    const n = requireAnalyte('albuminCr', v.ratio, v.ratioUnit, 0, 3000, 'Albumin/creatinine ratio', 'ratio');
    const acr = n.value;

    const steps = [];
    if (n.converted) {
      steps.push(step('Convert to SI', `${fmt(n.from.value, 0)} mg/g ÷ 8.84`, `${fmt(acr, 1)} mg/mmol`));
    }
    steps.push(step('Compare with handbook bands',
      '<2.5 normal · 2–20 mildly ↑ · 20–220 moderately ↑ · >220 nephrotic', `${fmt(acr, 1)} mg/mmol`));

    let interp;
    if (acr > 220) interp = interpret(LEVEL.DANGER, `${fmt(acr, 1)} mg/mmol — nephrotic range`);
    else if (acr >= 20) interp = interpret(LEVEL.WARN, `${fmt(acr, 1)} mg/mmol — moderately increased`, 'KDIGO albuminuria category A3.');
    else if (acr >= 2.5) interp = interpret(LEVEL.WARN, `${fmt(acr, 1)} mg/mmol — mildly increased`, 'KDIGO albuminuria category A2.');
    else interp = interpret(LEVEL.NORMAL, `${fmt(acr, 1)} mg/mmol — normal`, 'KDIGO albuminuria category A1.');

    return {
      value: acr, unit: 'mg/mmol', label: 'Albumin/creatinine ratio', decimals: 1,
      steps,
      extra: [
        { label: 'ACR', value: fmt(acr, 1), unit: 'mg/mmol' },
        { label: 'In US units', value: fmt(acr * 8.84, 0), unit: 'mg/g' },
      ],
      interpretation: interp,
    };
  },
  considerations: [
    'Canadian SI bands (mg/mmol): normal <2.5, mildly increased 2–20, moderately increased 20–220, nephrotic >220.',
    'KDIGO albuminuria categories map roughly as A1 <3, A2 3–30, A3 >30 mg/mmol — the KDIGO 30 and 300 mg/g cut-offs divided by 8.84.',
    'ACR is more specific than PCR for glomerular disease, because albumin is filtered at the glomerulus while low molecular weight proteins reflect tubular handling.',
    'A high PCR with a proportionally low ACR points to tubular rather than glomerular proteinuria.',
  ],
};

export const proteinuria24h = {
  id: 'protein-24h',
  category: 'Proteinuria',
  title: '24-Hour Urine Protein',
  source: 'CAPN Handbook 2021, ch.2 (p.16)',
  formula: 'Protein excretion = total 24-hour protein / BSA   →   mg/m²/day',
  inputs: [
    { key: 'totalProtein', label: 'Total protein in 24 hr', unit: 'mg', min: 0, max: 50000, step: 1 },
    { key: 'height', label: 'Height / length', unit: 'cm', min: 20, max: 220, step: 0.1 },
    { key: 'weight', label: 'Weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
  ],
  compute(v) {
    const total = requireRange(v.totalProtein, 0, 50000, 'Total protein', 'totalProtein');
    const h = requireRange(v.height, 20, 220, 'Height', 'height');
    const w = requireRange(v.weight, 0.4, 200, 'Weight', 'weight');

    const bsa = bsaMosteller(h, w);
    const perM2 = total / bsa;

    const steps = [
      step('Body surface area (Mosteller)', `√(${fmt(h)} × ${fmt(w, 2)} / 3600)`, `${fmt(bsa, 3)} m²`),
      step('Normalise to body surface area', `${fmt(total, 0)} mg ÷ ${fmt(bsa, 3)} m²`, `${fmt(perM2, 0)} mg/m²/day`),
      step('Compare', 'normal <100 · nephrotic >1000 mg/m²/day',
        perM2 > 1000 ? 'nephrotic range' : perM2 >= 100 ? 'abnormal' : 'normal'),
    ];

    let interp;
    if (perM2 > 1000) interp = interpret(LEVEL.DANGER, `${fmt(perM2, 0)} mg/m²/day — nephrotic range`);
    else if (perM2 >= 100) interp = interpret(LEVEL.WARN, `${fmt(perM2, 0)} mg/m²/day — abnormal`);
    else interp = interpret(LEVEL.NORMAL, `${fmt(perM2, 0)} mg/m²/day — normal`);

    return {
      value: perM2, unit: 'mg/m²/day', label: 'Protein excretion', decimals: 0,
      steps,
      extra: [
        { label: 'Per body surface area', value: fmt(perM2, 0), unit: 'mg/m²/day' },
        { label: 'Absolute', value: fmt(total, 0), unit: 'mg/day' },
        { label: 'Normal', value: '< 100', unit: 'mg/m²/day (or <150 mg/day)' },
        { label: 'Nephrotic', value: '> 1000', unit: 'mg/m²/day (or >3.5 g/day)' },
      ],
      interpretation: interp,
    };
  },
  considerations: [
    'The 24-hour collection is the most accurate quantification but is difficult in infants and young children — PCR on a first-morning sample correlates well and is usually preferred in practice.',
    'An incomplete collection is the commonest error. Check that total creatinine excretion is plausible before trusting the protein figure.',
    'Absolute cut-offs (150 mg/day normal, 3.5 g/day nephrotic) are adult figures. In children, normalise to body surface area.',
  ],
};

export const nephroticSteroids = {
  id: 'nephrotic-steroids',
  category: 'Proteinuria',
  title: 'Nephrotic Syndrome — Steroid & Albumin Dosing',
  source: 'CAPN Handbook 2021, ch.6',
  formula: 'Prednisone 60 mg/m²/day (or 2 mg/kg/day), maximum 60 mg/day, for 6 weeks',
  inputs: [
    { key: 'height', label: 'Height / length', unit: 'cm', min: 20, max: 220, step: 0.1 },
    { key: 'weight', label: 'Weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
  ],
  compute(v) {
    const h = requireRange(v.height, 20, 220, 'Height', 'height');
    const w = requireRange(v.weight, 0.4, 200, 'Weight', 'weight');

    const bsa = bsaMosteller(h, w);
    const byBsa = 60 * bsa;
    const byWeight = 2 * w;
    const dailyDose = Math.min(byBsa, 60);
    const altBsa = 40 * bsa;
    const altDose = Math.min(altBsa, 40);

    const albuminG = 1 * w;
    const albumin20Ml = albuminG / 0.2;
    const albumin25Ml = albuminG / 0.25;
    const furosemide = 1 * w;

    const steps = [
      step('Body surface area (Mosteller)', `√(${fmt(h)} × ${fmt(w, 2)} / 3600)`, `${fmt(bsa, 3)} m²`),
      step('Induction dose by BSA', `60 mg/m² × ${fmt(bsa, 3)} m²`, `${fmt(byBsa)} mg/day`),
      step('Cross-check by weight', `2 mg/kg × ${fmt(w, 2)} kg`, `${fmt(byWeight)} mg/day`),
      step('Apply the 60 mg/day cap', `min(${fmt(byBsa)}, 60)`, `${fmt(dailyDose)} mg/day`),
      step('Alternate-day taper dose', `min(40 × ${fmt(bsa, 3)}, 40)`, `${fmt(altDose)} mg every other day`),
    ];

    const warnings = [];
    if (byBsa > 60) {
      warnings.push(interpret(LEVEL.INFO, `Uncapped BSA dose would be ${fmt(byBsa)} mg — capped at 60 mg/day.`));
    }
    warnings.push(interpret(LEVEL.WARN,
      'Albumin should be reserved for diuretic-resistant edema or hemoconcentration. It can precipitate pulmonary edema, heart failure, and AKI.'));

    return {
      value: dailyDose, unit: 'mg/day', label: 'Prednisone induction dose',
      steps,
      extra: [
        { label: 'Induction (6 weeks)', value: fmt(dailyDose), unit: 'mg/day' },
        { label: 'By weight (cross-check)', value: fmt(byWeight), unit: 'mg/day' },
        { label: 'Alternate-day taper', value: fmt(altDose), unit: 'mg every other day' },
        { label: 'Albumin 1 g/kg', value: fmt(albuminG), unit: 'g' },
        { label: '— as 20% albumin', value: fmt(albumin20Ml, 0), unit: 'mL over 4 hr' },
        { label: '— as 25% albumin', value: fmt(albumin25Ml, 0), unit: 'mL over 4 hr' },
        { label: 'Furosemide with albumin', value: fmt(furosemide), unit: 'mg' },
      ],
      warnings,
      interpretation: interpret(LEVEL.INFO,
        `Prednisone ${fmt(dailyDose)} mg daily × 6 weeks, then ${fmt(altDose)} mg alternate-day`,
        'Taper thereafter per local protocol.'),
    };
  },
  considerations: [
    'The handbook specifies 60 mg/m²/day (or 2 mg/kg/day) for 6 weeks, then taper per local institutional protocol. Confirm the taper against your centre\'s protocol — these vary across Canada.',
    'BSA and weight-based dosing diverge in obesity and in very small children; the BSA route is the ISKDC/APN convention and 60 mg/day is the standard cap.',
    'The handbook gives albumin as 25% at 0.5–1 g/kg over 4 hours with furosemide 1 mg/kg midway and at the end of the infusion.',
    'Albumin is for diuretic-resistant edema or anasarca with hemoconcentration, not for a low serum albumin alone. Consider FENa to predict whether diuretics alone will work.',
    'Steroid-related harms accumulate quickly in children: growth suppression, bone density, glucose intolerance, behaviour, and cataracts. Document baseline height, weight, and BP.',
    'A first presentation under 1 year, or with hypertension, hematuria, low C3, or kidney impairment, points away from minimal change disease — these children need a different work-up before empirical steroids.',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.6.'],
};

export const calculators = [proteinCreatinineRatio, albuminCreatinineRatio, proteinuria24h, nephroticSteroids];
