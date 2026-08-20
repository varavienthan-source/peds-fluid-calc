/**
 * Maintenance fluids, deficit replacement, and the physiologic (insensible + output) model.
 *
 * The CAPN Resident Handbook opens its fluids chapter with an explicit warning:
 * "the first rule in nephrology to remember: the 4-2-1 rule is not always the
 * right answer". 4-2-1 was derived from calorimetric losses in *healthy*
 * children and does not hold in AKI, polyuria/oliguria, or electrolyte
 * derangement. Both models are therefore offered, with 4-2-1 carrying its caveat.
 */
'use strict';

import { fmt, fmtDuration } from '../fmt.js';
import { step, interpret, LEVEL, requirePositive, requireNumber, requireRange, weightWarnings } from '../descriptor.js';
import { bsaMosteller } from './growth.js';

/** Holliday-Segar 4-2-1 maintenance rate in mL/hr. */
export function hollidaySegarRate(weightKg) {
  if (!weightKg || weightKg <= 0) return 0;
  if (weightKg <= 10) return weightKg * 4;
  if (weightKg <= 20) return 40 + (weightKg - 10) * 2;
  return 60 + (weightKg - 20);
}

/** Holliday-Segar daily volume in mL/day (100/50/20 per kg). */
export function hollidaySegarDaily(weightKg) {
  if (!weightKg || weightKg <= 0) return 0;
  if (weightKg <= 10) return weightKg * 100;
  if (weightKg <= 20) return 1000 + (weightKg - 10) * 50;
  return 1500 + (weightKg - 20) * 20;
}

/** Smallest sensible IV bag for a given hourly rate. Ported from the original app. */
export function bagSize(rateMlHr) {
  if (rateMlHr <= 40) return 250;
  if (rateMlHr <= 80) return 500;
  return 1000;
}

export const maintenance421 = {
  id: 'maintenance-421',
  category: 'Fluids',
  title: 'Maintenance Fluids (4-2-1)',
  source: 'Holliday & Segar, Pediatrics 1957 · caveats per CAPN Handbook 2021 ch.4',
  formula: '4 mL/kg/hr for the first 10 kg + 2 mL/kg/hr for the next 10 kg + 1 mL/kg/hr thereafter',
  inputs: [
    { key: 'weight', label: 'Weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
  ],
  compute(v) {
    const w = requireRange(v.weight, 0.4, 200, 'Weight', 'weight');
    const warnings = weightWarnings(w);

    const steps = [];
    let rate;
    if (w <= 10) {
      rate = w * 4;
      steps.push(step('First 10 kg at 4 mL/kg/hr', `${fmt(w, 2)} kg × 4`, `${fmt(rate)} mL/hr`));
    } else if (w <= 20) {
      const first = 40;
      const next = (w - 10) * 2;
      rate = first + next;
      steps.push(step('First 10 kg at 4 mL/kg/hr', '10 × 4', '40 mL/hr'));
      steps.push(step('Next 10 kg at 2 mL/kg/hr', `${fmt(w - 10, 2)} × 2`, `${fmt(next)} mL/hr`));
      steps.push(step('Total', `40 + ${fmt(next)}`, `${fmt(rate)} mL/hr`));
    } else {
      const above = w - 20;
      rate = 60 + above;
      steps.push(step('First 10 kg at 4 mL/kg/hr', '10 × 4', '40 mL/hr'));
      steps.push(step('Next 10 kg at 2 mL/kg/hr', '10 × 2', '20 mL/hr'));
      steps.push(step('Remainder at 1 mL/kg/hr', `${fmt(above, 2)} × 1`, `${fmt(above)} mL/hr`));
      steps.push(step('Total', `40 + 20 + ${fmt(above)}`, `${fmt(rate)} mL/hr`));
    }

    const daily = hollidaySegarDaily(w);
    const bag = bagSize(rate);

    if (w > 70 && rate > 130) {
      warnings.push(interpret(LEVEL.WARN,
        `Uncapped 4-2-1 gives ${fmt(rate)} mL/hr. Adult maintenance is usually capped at 100–130 mL/hr.`));
    }

    return {
      value: rate, unit: 'mL/hr', label: 'Maintenance rate',
      steps,
      extra: [
        { label: 'Daily volume', value: fmt(daily, 0), unit: 'mL/day' },
        { label: '1.5 × maintenance', value: fmt(rate * 1.5), unit: 'mL/hr' },
        { label: '2 × maintenance', value: fmt(rate * 2), unit: 'mL/hr' },
        { label: 'Suggested bag', value: `${bag}`, unit: `mL — runs ${fmtDuration(bag / rate)}` },
      ],
      warnings,
      interpretation: interpret(LEVEL.INFO,
        `${fmt(rate)} mL/hr (${fmt(daily, 0)} mL/day)`,
        'Healthy-child estimate only — see considerations before using in kidney disease.'),
    };
  },
  considerations: [
    'THE HANDBOOK WARNS AGAINST DEFAULTING TO THIS. 4-2-1 was derived from calorimetric losses in healthy children and is often the wrong answer in AKI, polyuria or oliguria, or any electrolyte derangement. In those patients use the physiologic model (insensible losses + measured output).',
    'Use an ISOTONIC fluid. The Canadian Paediatric Society advises isotonic maintenance (D5W-NS, D5W-Ringer\'s lactate, or D5W-Plasmalyte) for ages 1 month to 18 years; hypotonic fluid below 0.45% NaCl should not be used for routine maintenance because of hospital-acquired hyponatremia.',
    'This is maintenance only. It excludes deficit, ongoing losses, and fluid given with medications — all of which must be added or subtracted separately.',
    'Recheck electrolytes within 24 hours of starting any maintenance infusion in a child with kidney disease.',
    'Add potassium (commonly 20 mmol/L) only once the patient is passing urine and serum potassium is known.',
  ],
  references: [
    'Holliday MA, Segar WE. The maintenance need for water in parenteral fluid therapy. Pediatrics 1957;19:823-32.',
    'CPS practice point: Risk of acute hyponatremia in hospitalized children and youth receiving maintenance IV fluids.',
  ],
};

export const maintenancePhysiologic = {
  id: 'maintenance-physiologic',
  category: 'Fluids',
  title: 'Maintenance Fluids (insensible + output)',
  source: 'CAPN Paediatric Nephrology Resident Handbook 2021, ch.4 & ch.5',
  formula: 'Total fluid intake = insensible losses (400 mL/m²/day) + urine output + other measured losses',
  inputs: [
    { key: 'height', label: 'Height / length', unit: 'cm', min: 20, max: 220, step: 0.1 },
    { key: 'weight', label: 'Weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
    {
      key: 'insensibleRate', label: 'Insensible allowance', unit: 'mL/m²/day', type: 'select', default: '400',
      options: [
        { value: '300', label: '300 — low end (AKI range)' },
        { value: '400', label: '400 — handbook default' },
        { value: '500', label: '500 — high end (fever, burns)' },
      ],
    },
    { key: 'urineOutput', label: 'Urine output over the period', unit: 'mL', min: 0, step: 1, optional: true },
    { key: 'hours', label: 'Period measured', unit: 'hr', min: 1, max: 24, step: 1, default: 24 },
    { key: 'otherLosses', label: 'Other losses (GI, drains, CSF)', unit: 'mL', min: 0, step: 1, optional: true },
  ],
  compute(v) {
    const h = requireRange(v.height, 20, 220, 'Height', 'height');
    const w = requireRange(v.weight, 0.4, 200, 'Weight', 'weight');
    const hours = requireRange(v.hours ?? 24, 1, 24, 'Period measured', 'hours');
    const urine = v.urineOutput ? requireNumber(v.urineOutput, 'Urine output', 'urineOutput') : 0;
    const other = v.otherLosses ? requireNumber(v.otherLosses, 'Other losses', 'otherLosses') : 0;
    const perM2 = Number(v.insensibleRate ?? 400);

    const bsa = bsaMosteller(h, w);
    const insensibleDay = bsa * perM2;
    const insensiblePeriod = insensibleDay * (hours / 24);
    const total = insensiblePeriod + urine + other;
    const rate = total / hours;

    const steps = [
      step('Body surface area (Mosteller)', `√(${fmt(h)} × ${fmt(w, 2)} / 3600)`, `${fmt(bsa, 3)} m²`),
      step('Insensible losses per day', `${fmt(bsa, 3)} m² × ${perM2} mL/m²/day`, `${fmt(insensibleDay, 0)} mL/day`),
    ];
    if (hours !== 24) {
      steps.push(step(`Scale to ${fmt(hours)} hr`, `${fmt(insensibleDay, 0)} × ${fmt(hours)}/24`, `${fmt(insensiblePeriod, 0)} mL`));
    }
    steps.push(step('Add measured urine output', `${fmt(insensiblePeriod, 0)} + ${fmt(urine, 0)}`, `${fmt(insensiblePeriod + urine, 0)} mL`));
    if (other > 0) {
      steps.push(step('Add other measured losses', `${fmt(insensiblePeriod + urine, 0)} + ${fmt(other, 0)}`, `${fmt(total, 0)} mL`));
    }
    steps.push(step('Convert to an hourly rate', `${fmt(total, 0)} mL / ${fmt(hours)} hr`, `${fmt(rate)} mL/hr`));

    const urineRate = urine / hours / w;
    const warnings = weightWarnings(w);
    if (urine > 0 && urineRate < 0.5) {
      warnings.push(interpret(LEVEL.WARN,
        `Urine output ${fmt(urineRate, 2)} mL/kg/hr is oliguric (<0.5). This meets a KDIGO AKI urine-output criterion if sustained.`));
    }

    return {
      value: rate, unit: 'mL/hr', label: 'Total fluid intake',
      steps,
      extra: [
        { label: 'Insensible component', value: fmt(insensiblePeriod, 0), unit: `mL / ${fmt(hours)} hr` },
        { label: 'Replacement component', value: fmt(urine + other, 0), unit: `mL / ${fmt(hours)} hr` },
        { label: 'Total volume', value: fmt(total, 0), unit: `mL / ${fmt(hours)} hr` },
        { label: 'Urine output', value: urine ? fmt(urineRate, 2) : '—', unit: 'mL/kg/hr' },
        { label: 'Anuric restriction (insensibles only)', value: fmt(insensibleDay / 24), unit: 'mL/hr' },
        { label: 'SIADH restriction (2 × insensibles)', value: fmt((insensibleDay * 2) / 24), unit: 'mL/hr' },
      ],
      warnings,
      interpretation: interpret(LEVEL.INFO, `${fmt(rate)} mL/hr (${fmt(total, 0)} mL over ${fmt(hours)} hr)`),
    };
  },
  considerations: [
    'This is the handbook\'s preferred model whenever 4-2-1 does not apply: AKI, polyuria, oliguria, or electrolyte derangement.',
    'Practical prescription: run the insensible component as a continuous D5/NS infusion and replace urine and GI losses mL:mL with normal saline. Replace with NS until a urine sodium is available, so the serum sodium is not dropped inadvertently.',
    'In fluid overload with anuria, restrict to insensible losses alone (300–500 mL/m²/day).',
    'In SIADH, restrict to roughly twice insensible losses and consider furosemide to promote free-water clearance.',
    'Losses must be measured, not assumed — reweigh and re-tally at least every 12 hours in an unstable child.',
    'If the enteral route is available it is more physiologic than IV for replacing free water.',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.4 (Maintenance Fluids) and ch.5 (Management of AKI).'],
};

export const deficitReplacement = {
  id: 'deficit-replacement',
  category: 'Fluids',
  title: 'Dehydration Deficit Replacement',
  source: 'Standard paediatric deficit therapy; bolus per CAPN Handbook ch.5',
  formula: 'Deficit (mL) = weight (kg) × % dehydration × 10   ·   half over 8 hr, half over the next 16 hr',
  inputs: [
    { key: 'weight', label: 'Weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
    {
      key: 'dehydration', label: 'Degree of dehydration', unit: '%', type: 'select', default: '5',
      options: [
        { value: '0', label: '0% — none' },
        { value: '3', label: '3% — minimal' },
        { value: '5', label: '5% — mild' },
        { value: '10', label: '10% — moderate' },
        { value: '15', label: '15% — severe' },
      ],
    },
    { key: 'ongoingLosses', label: 'Ongoing losses', unit: 'mL/hr', min: 0, step: 1, optional: true },
    { key: 'npo', label: 'Nil by mouth', type: 'checkbox', default: false },
  ],
  compute(v) {
    const w = requireRange(v.weight, 0.4, 200, 'Weight', 'weight');
    const pct = requireRange(Number(v.dehydration ?? 0), 0, 15, 'Degree of dehydration', 'dehydration');
    const ongoing = v.ongoingLosses ? requireNumber(v.ongoingLosses, 'Ongoing losses', 'ongoingLosses') : 0;
    const warnings = weightWarnings(w);

    const maint = hollidaySegarRate(w);
    const deficitTotal = w * pct * 10;
    const firstHalf = deficitTotal / 2;
    const rate8 = firstHalf / 8;
    const rate16 = firstHalf / 16;
    const npoRate = v.npo ? w * 1 : 0;

    const total8 = maint + rate8 + npoRate + ongoing;
    const total16 = maint + rate16 + npoRate + ongoing;

    const steps = [
      step('Maintenance (4-2-1)', `weight ${fmt(w, 2)} kg`, `${fmt(maint)} mL/hr`),
    ];
    if (pct > 0) {
      steps.push(step('Total fluid deficit', `${fmt(w, 2)} kg × ${fmt(pct)}% × 10`, `${fmt(deficitTotal, 0)} mL`));
      steps.push(step('First half over 8 hr', `(${fmt(deficitTotal, 0)} / 2) / 8`, `${fmt(rate8)} mL/hr`));
      steps.push(step('Second half over 16 hr', `(${fmt(deficitTotal, 0)} / 2) / 16`, `${fmt(rate16)} mL/hr`));
    }
    if (npoRate > 0) steps.push(step('NPO allowance (1 mL/kg/hr)', `${fmt(w, 2)} × 1`, `${fmt(npoRate)} mL/hr`));
    if (ongoing > 0) steps.push(step('Ongoing losses', 'as entered', `${fmt(ongoing)} mL/hr`));
    steps.push(step('Rate for hours 0–8',
      `${fmt(maint)}${pct > 0 ? ` + ${fmt(rate8)}` : ''}${npoRate ? ` + ${fmt(npoRate)}` : ''}${ongoing ? ` + ${fmt(ongoing)}` : ''}`,
      `${fmt(total8)} mL/hr`));
    steps.push(step('Rate for hours 8–24',
      `${fmt(maint)}${pct > 0 ? ` + ${fmt(rate16)}` : ''}${npoRate ? ` + ${fmt(npoRate)}` : ''}${ongoing ? ` + ${fmt(ongoing)}` : ''}`,
      `${fmt(total16)} mL/hr`));

    if (pct >= 10) {
      warnings.push(interpret(LEVEL.DANGER,
        `Give a normal saline bolus first: 10–20 mL/kg over 30 min = ${fmt(w * 10, 0)}–${fmt(w * 20, 0)} mL. Reassess and repeat as needed before starting deficit replacement.`));
    }

    return {
      value: total8, unit: 'mL/hr', label: 'Rate, first 8 hours',
      steps,
      extra: [
        { label: 'Maintenance', value: fmt(maint), unit: 'mL/hr' },
        { label: 'Total deficit', value: fmt(deficitTotal, 0), unit: 'mL' },
        { label: 'Rate hours 0–8', value: fmt(total8), unit: 'mL/hr' },
        { label: 'Rate hours 8–24', value: fmt(total16), unit: 'mL/hr' },
        { label: 'NS bolus 20 mL/kg', value: fmt(w * 20, 0), unit: 'mL' },
      ],
      warnings,
      interpretation: interpret(LEVEL.INFO,
        `${fmt(total8)} mL/hr for 8 hr, then ${fmt(total16)} mL/hr for 16 hr`),
    };
  },
  considerations: [
    'Boluses are given BEFORE and IN ADDITION TO this calculation, and are not subtracted from the deficit here. Restore circulation first.',
    'This scheme assumes ISOTONIC dehydration. In hypernatremic dehydration do not use it — calculate a free water deficit and correct over 48–72 hours, since sodium must not fall faster than 8–10 mmol/L/day.',
    'In hyponatremic dehydration, calculate the sodium deficit separately and account for sodium already given in boluses.',
    'Clinical estimates of dehydration percentage are imprecise; weight change against a recent known weight is far more reliable when available.',
    'Reassess and re-weigh at least every 8 hours, and recheck electrolytes before stepping down the rate.',
  ],
  references: ['CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.4-5.'],
};

export const calculators = [maintenance421, maintenancePhysiologic, deficitReplacement];
