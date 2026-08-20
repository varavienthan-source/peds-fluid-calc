/** Acute kidney injury: KDIGO staging, fractional excretion, fluid overload. */
'use strict';

import { fmt } from '../fmt.js';
import { step, interpret, LEVEL, requireNumber, requireRange, requireAnalyte } from '../descriptor.js';

export const kdigoStaging = {
  id: 'kdigo-aki',
  category: 'Acute kidney injury',
  title: 'KDIGO AKI Staging',
  source: 'CAPN Handbook 2021, ch.5, Table 5.1 (KDIGO 2012, paediatric)',
  formula: 'Stage by whichever criterion — creatinine rise or urine output — gives the higher stage.',
  inputs: [
    { key: 'baselineCr', label: 'Baseline creatinine', unit: 'µmol/L', min: 5, max: 2000, step: 1, analyte: 'creatinine' },
    { key: 'currentCr', label: 'Current creatinine', unit: 'µmol/L', min: 5, max: 3000, step: 1, analyte: 'creatinine' },
    { key: 'age', label: 'Age', unit: 'years', min: 0, max: 25, step: 0.1, optional: true },
    { key: 'egfr', label: 'Current eGFR (if known)', unit: 'mL/min/1.73m²', min: 1, max: 200, step: 1, optional: true },
    { key: 'urineOutput', label: 'Urine output', unit: 'mL/kg/hr', min: 0, max: 10, step: 0.01, optional: true },
    { key: 'urineHours', label: 'Sustained for', unit: 'hr', min: 0, max: 72, step: 1, optional: true },
  ],
  compute(v) {
    const base = requireAnalyte('creatinine', v.baselineCr, v.baselineCrUnit, 1, 3000, 'Baseline creatinine', 'baselineCr').value;
    const curr = requireAnalyte('creatinine', v.currentCr, v.currentCrUnit, 1, 3000, 'Current creatinine', 'currentCr').value;

    const ratio = curr / base;
    const rise = curr - base;
    const age = v.age !== undefined && v.age !== '' ? Number(v.age) : null;

    const steps = [
      step('Fold change from baseline', `${fmt(curr)} ÷ ${fmt(base)}`, `${fmt(ratio, 2)} ×`),
      step('Absolute rise', `${fmt(curr)} − ${fmt(base)}`, `${fmt(rise)} µmol/L`),
    ];

    // --- creatinine arm ---
    let crStage = 0;
    let crReason = 'No change meeting criteria';
    if (ratio >= 3.0) { crStage = 3; crReason = '≥3.0 × baseline'; }
    else if (ratio >= 2.0) { crStage = 2; crReason = '2.0–2.9 × baseline'; }
    else if (ratio >= 1.5) { crStage = 1; crReason = '1.5–1.9 × baseline'; }
    else if (rise >= 26) { crStage = 1; crReason = 'rise ≥26 µmol/L'; }

    if (age !== null && age >= 18 && curr >= 353) {
      if (crStage < 3) { crStage = 3; crReason = 'creatinine ≥353 µmol/L (≥18 years)'; }
    }
    if (v.egfr !== undefined && v.egfr !== '' && (age === null || age < 18) && Number(v.egfr) < 35) {
      if (crStage < 3) { crStage = 3; crReason = 'eGFR <35 mL/min/1.73m² (<18 years)'; }
    }
    steps.push(step('Creatinine criterion', crReason, crStage ? `Stage ${crStage}` : 'Stage 0'));

    // --- urine output arm ---
    let uoStage = 0;
    let uoReason = 'Not assessed';
    const uo = v.urineOutput !== undefined && v.urineOutput !== '' ? Number(v.urineOutput) : null;
    const uh = v.urineHours !== undefined && v.urineHours !== '' ? Number(v.urineHours) : null;
    if (uo !== null && uh !== null) {
      if (uo === 0 && uh >= 12) { uoStage = 3; uoReason = `anuria for ${fmt(uh)} hr`; }
      else if (uo <= 0.3 && uh >= 24) { uoStage = 3; uoReason = `≤0.3 mL/kg/hr for ${fmt(uh)} hr`; }
      else if (uo < 0.5 && uh >= 12) { uoStage = 2; uoReason = `<0.5 mL/kg/hr for ${fmt(uh)} hr`; }
      else if (uo < 0.5 && uh >= 6) { uoStage = 1; uoReason = `<0.5 mL/kg/hr for ${fmt(uh)} hr`; }
      else { uoReason = `${fmt(uo, 2)} mL/kg/hr for ${fmt(uh)} hr — no criterion met`; }
      steps.push(step('Urine output criterion', uoReason, uoStage ? `Stage ${uoStage}` : 'Stage 0'));
    }

    const stage = Math.max(crStage, uoStage);
    steps.push(step('Final stage (higher of the two arms)',
      `max(creatinine ${crStage}, urine output ${uoStage})`, `Stage ${stage}`));

    const levels = [LEVEL.NORMAL, LEVEL.WARN, LEVEL.WARN, LEVEL.DANGER];
    const warnings = [];
    if (stage >= 2) {
      warnings.push(interpret(LEVEL.WARN, 'Review and stop nephrotoxins; adjust renally excreted drugs once GFR is below 50 mL/min/1.73m².'));
    }
    if (stage === 3) {
      warnings.push(interpret(LEVEL.DANGER, 'Stage 3 — discuss renal replacement therapy. Percent fluid overload helps decide timing.'));
    }

    return {
      value: stage, unit: '', label: 'KDIGO AKI stage', decimals: 0,
      steps,
      extra: [
        { label: 'Stage by creatinine', value: `${crStage}`, unit: crReason },
        { label: 'Stage by urine output', value: uo !== null ? `${uoStage}` : '—', unit: uo !== null ? uoReason : 'not assessed' },
        { label: 'Fold change', value: fmt(ratio, 2), unit: '× baseline' },
      ],
      warnings,
      interpretation: interpret(levels[stage], stage === 0 ? 'No AKI by KDIGO criteria' : `KDIGO AKI Stage ${stage}`),
    };
  },
  considerations: [
    'The paediatric-specific stage 3 criterion is eGFR below 35 mL/min/1.73m², used instead of the adult creatinine threshold of 353 µmol/L in patients under 18.',
    'Stage by whichever arm is worse. The urine output criterion is frequently the earlier signal and is often the one missed.',
    'Baseline creatinine is the weak point. Where no recent value exists, the lowest creatinine in the past 3 months is a reasonable substitute; back-calculating from an assumed normal GFR systematically overcalls AKI.',
    'Creatinine lags injury by 24–48 hours. A normal creatinine early does not exclude significant injury, and eGFR overestimates function while creatinine is still rising.',
    'Creatinine is diluted by fluid overload, which masks AKI in exactly the patients most at risk.',
    'Staging is not a diagnosis. Establish pre-renal, intrinsic, or post-renal cause — FENa, urinalysis with microscopy, and renal ultrasound.',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, Table 5.1.'],
};

export const fractionalExcretion = {
  id: 'fractional-excretion',
  category: 'Acute kidney injury',
  title: 'Fractional Excretion of Sodium / Urea',
  source: 'CAPN Handbook 2021, ch.5',
  formula: 'FENa (%) = 100 × (urine Na × serum Cr) / (serum Na × urine Cr)',
  inputs: [
    { key: 'urineNa', label: 'Urine sodium', unit: 'mmol/L', min: 0, max: 300, step: 1 },
    { key: 'serumNa', label: 'Serum sodium', unit: 'mmol/L', min: 90, max: 200, step: 1 },
    { key: 'urineCr', label: 'Urine creatinine', unit: 'µmol/L', min: 100, max: 100000, step: 1 },
    { key: 'serumCr', label: 'Serum creatinine', unit: 'µmol/L', min: 5, max: 3000, step: 1, analyte: 'creatinine' },
    { key: 'urineUrea', label: 'Urine urea (for FEUrea)', unit: 'mmol/L', min: 0, max: 1000, step: 0.1, optional: true },
    { key: 'serumUrea', label: 'Serum urea (for FEUrea)', unit: 'mmol/L', min: 0, max: 100, step: 0.1, optional: true, analyte: 'urea' },
    { key: 'neonate', label: 'Neonate', type: 'checkbox', default: false },
    { key: 'onDiuretics', label: 'On diuretics', type: 'checkbox', default: false },
  ],
  compute(v) {
    const una = requireRange(v.urineNa, 0, 300, 'Urine sodium', 'urineNa');
    const sna = requireRange(v.serumNa, 90, 200, 'Serum sodium', 'serumNa');
    const ucr = requireRange(v.urineCr, 1, 100000, 'Urine creatinine', 'urineCr');
    const scr = requireAnalyte('creatinine', v.serumCr, v.serumCrUnit, 1, 3000, 'Serum creatinine', 'serumCr').value;

    const numerator = una * scr;
    const denominator = sna * ucr;
    const fena = 100 * (numerator / denominator);

    const steps = [
      step('Numerator: urine Na × serum Cr', `${fmt(una)} × ${fmt(scr)}`, `${fmt(numerator, 0)}`),
      step('Denominator: serum Na × urine Cr', `${fmt(sna)} × ${fmt(ucr)}`, `${fmt(denominator, 0)}`),
      step('Fractional excretion', `100 × ${fmt(numerator, 0)} ÷ ${fmt(denominator, 0)}`, `${fmt(fena, 2)} %`),
    ];

    const extra = [{ label: 'FENa', value: fmt(fena, 2), unit: '%' }];
    const warnings = [];
    let feurea = null;

    if (v.urineUrea && v.serumUrea) {
      const uur = requireRange(v.urineUrea, 0.1, 1000, 'Urine urea', 'urineUrea');
      const sur = requireAnalyte('urea', v.serumUrea, v.serumUreaUnit, 0.1, 100, 'Serum urea', 'serumUrea').value;
      feurea = 100 * ((uur * scr) / (sur * ucr));
      steps.push(step('Fractional excretion of urea', `100 × (${fmt(uur, 1)} × ${fmt(scr)}) ÷ (${fmt(sur, 1)} × ${fmt(ucr)})`, `${fmt(feurea, 1)} %`));
      extra.push({ label: 'FEUrea', value: fmt(feurea, 1), unit: '%' });
    }

    if (v.onDiuretics) {
      warnings.push(interpret(LEVEL.DANGER,
        'On diuretics, FENa is not interpretable — natriuresis is drug-induced. Use FEUrea instead (<35% suggests pre-renal).'));
    }

    let interp;
    const lowCut = v.neonate ? 2.5 : 1;
    const highCut = v.neonate ? 3 : 2;
    if (fena < lowCut) {
      interp = interpret(LEVEL.INFO, `FENa ${fmt(fena, 2)}% — pre-renal pattern`,
        'Sodium is being avidly reabsorbed, consistent with hypoperfusion.');
    } else if (fena > highCut) {
      interp = interpret(LEVEL.WARN, `FENa ${fmt(fena, 2)}% — intrinsic pattern`,
        v.neonate ? 'In neonates, FENa above 2–3% favours intrinsic kidney disease.' : 'Suggests tubular injury (e.g. ATN).');
    } else {
      interp = interpret(LEVEL.INFO, `FENa ${fmt(fena, 2)}% — not conclusive`,
        'The 1–2% band does not distinguish reliably. Interpret with urinalysis, microscopy and the clinical picture.');
    }

    if (v.neonate) {
      warnings.push(interpret(LEVEL.INFO,
        'Neonates have physiologically higher fractional sodium excretion because of tubular immaturity — the usual adult cut-offs do not apply.'));
    }

    return { value: fena, unit: '%', label: 'FENa', decimals: 2, steps, extra, warnings, interpretation: interp };
  },
  considerations: [
    'FENa is invalid on diuretics, in CKD, and with glycosuria or other osmotic diuresis. FEUrea (<35% pre-renal, >50% intrinsic) is the alternative when diuretics have been given.',
    'Neonates excrete sodium less efficiently; the threshold favouring intrinsic disease rises to above 2–3%.',
    'Urine and serum samples must be drawn at the same time, or the ratio is meaningless.',
    'A pre-renal pattern is not the same as a fluid-responsive patient. Interpret alongside volume status, and be cautious about reflexively giving fluid in oliguria.',
    'Units cancel in the ratio, so creatinine may be in µmol/L or mg/dL provided both values use the same unit.',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.5.'],
};

export const fluidOverload = {
  id: 'fluid-overload',
  category: 'Acute kidney injury',
  title: 'Percent Fluid Overload',
  source: 'Goldstein SL et al.; referenced CAPN Handbook 2021, ch.5',
  formula: '%FO = Σ(fluid in − fluid out) / baseline weight (kg) × 100',
  inputs: [
    { key: 'fluidIn', label: 'Cumulative fluid in', unit: 'mL', min: 0, max: 200000, step: 1 },
    { key: 'fluidOut', label: 'Cumulative fluid out', unit: 'mL', min: 0, max: 200000, step: 1 },
    { key: 'baselineWeight', label: 'Baseline (admission) weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
    { key: 'currentWeight', label: 'Current weight (cross-check)', unit: 'kg', min: 0.4, max: 200, step: 0.01, optional: true },
  ],
  compute(v) {
    const fin = requireRange(v.fluidIn, 0, 200000, 'Fluid in', 'fluidIn');
    const fout = requireRange(v.fluidOut, 0, 200000, 'Fluid out', 'fluidOut');
    const base = requireRange(v.baselineWeight, 0.4, 200, 'Baseline weight', 'baselineWeight');

    const net = fin - fout;
    const netL = net / 1000;
    const pct = (netL / base) * 100;

    const steps = [
      step('Net fluid balance', `${fmt(fin, 0)} − ${fmt(fout, 0)} mL`, `${fmt(net, 0)} mL`),
      step('Convert to litres', `${fmt(net, 0)} ÷ 1000`, `${fmt(netL, 2)} L`),
      step('As a percentage of baseline weight', `${fmt(netL, 2)} ÷ ${fmt(base, 2)} × 100`, `${fmt(pct, 1)} %`),
    ];

    const extra = [
      { label: 'Net balance', value: fmt(net, 0), unit: 'mL' },
      { label: 'Percent fluid overload', value: fmt(pct, 1), unit: '%' },
    ];

    const warnings = [];
    if (v.currentWeight) {
      const cw = requireRange(v.currentWeight, 0.4, 200, 'Current weight', 'currentWeight');
      const weightPct = ((cw - base) / base) * 100;
      steps.push(step('Cross-check by weight change', `(${fmt(cw, 2)} − ${fmt(base, 2)}) ÷ ${fmt(base, 2)} × 100`, `${fmt(weightPct, 1)} %`));
      extra.push({ label: 'By weight change', value: fmt(weightPct, 1), unit: '%' });
      if (Math.abs(weightPct - pct) > 5) {
        warnings.push(interpret(LEVEL.WARN,
          `Balance-derived (${fmt(pct, 1)}%) and weight-derived (${fmt(weightPct, 1)}%) figures differ by more than 5 points — suspect unrecorded intake or output.`));
      }
    }

    let interp;
    if (pct >= 20) {
      interp = interpret(LEVEL.DANGER, `${fmt(pct, 1)}% fluid overload`, 'Above 20% is associated with roughly threefold higher mortality in critically ill children.');
    } else if (pct >= 10) {
      interp = interpret(LEVEL.DANGER, `${fmt(pct, 1)}% fluid overload`, 'At or above 10%, mortality risk rises steeply. Escalate fluid removal and consider RRT.');
    } else if (pct >= 5) {
      interp = interpret(LEVEL.WARN, `${fmt(pct, 1)}% fluid overload`, 'Restrict intake and consider diuresis before this climbs further.');
    } else if (pct < 0) {
      interp = interpret(LEVEL.INFO, `${fmt(Math.abs(pct), 1)}% net negative balance`);
    } else {
      interp = interpret(LEVEL.NORMAL, `${fmt(pct, 1)}% fluid overload`);
    }

    return { value: pct, unit: '%', label: 'Percent fluid overload', decimals: 1, steps, extra, warnings, interpretation: interp };
  },
  considerations: [
    'Percent fluid overload predicts mortality in critically ill children independently of AKI severity, and helps decide when to start RRT.',
    'Use the pre-illness or admission weight as the denominator. Using the current (already overloaded) weight understates the problem.',
    'Daily weights are the more reliable measure — intake/output charts systematically miss insensible losses and unrecorded flushes.',
    'The 10% and 20% thresholds are risk markers, not treatment triggers on their own; interpret alongside respiratory status and perfusion.',
    'Early fluid removal in children requiring CRRT is associated with lower ICU mortality.',
  ],
};

export const calculators = [kdigoStaging, fractionalExcretion, fluidOverload];
