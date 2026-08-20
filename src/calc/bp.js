/**
 * Blood pressure classification.
 *
 * The handbook carries BOTH the AAP 2017 and the Hypertension Canada definitions,
 * and they differ for adolescents. Because the practitioner is Canadian, the
 * Hypertension Canada result is shown first — but both are always displayed and
 * labelled, never silently reconciled.
 *
 * Full percentile calculation requires the AAP normative tables (age/sex/height),
 * which are image-only in the supplied document. Until those are extracted, this
 * module implements the simplified absolute thresholds that both guidelines
 * explicitly endorse, and accepts a percentile if the user has looked it up.
 */
'use strict';

import { fmt } from '../fmt.js';
import { step, interpret, LEVEL, requireRange } from '../descriptor.js';

/** Hypertension Canada simplified thresholds. Returns null where the age band has none. */
export function hypertensionCanadaThreshold(ageYears) {
  if (ageYears >= 6 && ageYears < 12) return { systolic: 120, diastolic: 80, band: '6–11 years' };
  if (ageYears >= 12 && ageYears < 18) return { systolic: 130, diastolic: 85, band: '12–17 years' };
  return null;
}

/** AAP 2017 simplified threshold for adolescents. */
export function aapThreshold(ageYears) {
  if (ageYears >= 13) return { systolic: 130, diastolic: 80, band: '13 years and over' };
  return null;
}

export const bloodPressureClassification = {
  id: 'bp-classification',
  category: 'Blood pressure',
  title: 'Blood Pressure Classification',
  source: 'CAPN Handbook 2021, ch.7 — Hypertension Canada 2020 and AAP 2017',
  formula: 'Hypertension Canada: ≥95th percentile for age/sex/height on ≥3 occasions, OR >120/80 (6–11 y), OR >130/85 (12–17 y)',
  inputs: [
    { key: 'systolic', label: 'Systolic BP', unit: 'mmHg', min: 40, max: 250, step: 1 },
    { key: 'diastolic', label: 'Diastolic BP', unit: 'mmHg', min: 20, max: 180, step: 1 },
    { key: 'age', label: 'Age', unit: 'years', min: 1, max: 21, step: 0.1 },
    { key: 'percentile', label: 'BP percentile (if looked up)', unit: '%', min: 0, max: 100, step: 1, optional: true },
  ],
  compute(v) {
    const sbp = requireRange(v.systolic, 40, 250, 'Systolic BP', 'systolic');
    const dbp = requireRange(v.diastolic, 20, 180, 'Diastolic BP', 'diastolic');
    const age = requireRange(v.age, 1, 21, 'Age', 'age');

    const map = dbp + (sbp - dbp) / 3;
    const steps = [
      step('Mean arterial pressure', `${fmt(dbp)} + (${fmt(sbp)} − ${fmt(dbp)}) / 3`, `${fmt(map)} mmHg`),
    ];

    const warnings = [];
    if (dbp >= sbp) {
      warnings.push(interpret(LEVEL.DANGER, 'Diastolic is not below systolic — check the values entered.'));
    }

    // --- Hypertension Canada ---
    const hc = hypertensionCanadaThreshold(age);
    let hcVerdict;
    if (hc) {
      const meets = sbp > hc.systolic || dbp > hc.diastolic;
      steps.push(step(`Hypertension Canada simplified threshold (${hc.band})`,
        `${fmt(sbp)}/${fmt(dbp)} vs >${hc.systolic}/${hc.diastolic}`,
        meets ? 'threshold exceeded' : 'below threshold'));
      hcVerdict = meets
        ? `Exceeds the Hypertension Canada simplified threshold for ${hc.band} (>${hc.systolic}/${hc.diastolic})`
        : `Below the Hypertension Canada simplified threshold for ${hc.band} (>${hc.systolic}/${hc.diastolic})`;
    } else {
      hcVerdict = age < 6
        ? 'Under 6 years, Hypertension Canada has no simplified threshold — the percentile tables must be used.'
        : 'At 18 years and over, use adult thresholds (≥140/90).';
      steps.push(step('Hypertension Canada simplified threshold', `age ${fmt(age, 1)} y`, 'not applicable'));
    }

    // --- AAP 2017 ---
    const aap = aapThreshold(age);
    let aapVerdict;
    if (aap) {
      const meets = sbp >= aap.systolic || dbp >= aap.diastolic;
      steps.push(step(`AAP 2017 threshold (${aap.band})`,
        `${fmt(sbp)}/${fmt(dbp)} vs ≥${aap.systolic}/${aap.diastolic}`,
        meets ? 'hypertensive range' : 'below threshold'));
      let stage = 'Normal';
      if (sbp >= 140 || dbp >= 90) stage = 'Stage 2 hypertension';
      else if (sbp >= 130 || dbp >= 80) stage = 'Stage 1 hypertension';
      else if (sbp >= 120) stage = 'Elevated BP';
      aapVerdict = `${stage} (AAP ≥13 y absolute criteria)`;
    } else {
      aapVerdict = 'Under 13 years, AAP requires the age/sex/height percentile tables (≥95th percentile).';
      steps.push(step('AAP 2017 threshold', `age ${fmt(age, 1)} y`, 'percentile tables required'));
    }

    // --- percentile, if supplied ---
    const extra = [
      { label: 'Mean arterial pressure', value: fmt(map), unit: 'mmHg' },
      { label: 'Hypertension Canada', value: hc ? `>${hc.systolic}/${hc.diastolic}` : '—', unit: hc ? hc.band : 'percentile tables needed' },
      { label: 'AAP 2017', value: aap ? `≥${aap.systolic}/${aap.diastolic}` : '—', unit: aap ? aap.band : 'percentile tables needed' },
    ];

    let interp;
    if (v.percentile !== undefined && v.percentile !== '') {
      const pct = requireRange(v.percentile, 0, 100, 'BP percentile', 'percentile');
      extra.push({ label: 'BP percentile', value: fmt(pct, 0), unit: '%' });
      steps.push(step('Percentile-based classification', `${fmt(pct, 0)}th percentile`,
        pct >= 95 ? '≥95th — hypertensive range' : pct >= 90 ? '90th–95th — elevated' : 'below 90th — normal'));
      if (pct >= 95) {
        interp = interpret(LEVEL.DANGER, `${fmt(sbp)}/${fmt(dbp)} — ${fmt(pct, 0)}th percentile, hypertensive range`,
          'Requires confirmation on 3 separate occasions before diagnosing hypertension.');
      } else if (pct >= 90) {
        interp = interpret(LEVEL.WARN, `${fmt(sbp)}/${fmt(dbp)} — ${fmt(pct, 0)}th percentile, elevated BP`,
          'Repeat twice at this visit and average, per the measurement protocol.');
      } else {
        interp = interpret(LEVEL.NORMAL, `${fmt(sbp)}/${fmt(dbp)} — ${fmt(pct, 0)}th percentile, normal`);
      }
    } else {
      const flagged = (hc && (sbp > hc.systolic || dbp > hc.diastolic)) || (aap && (sbp >= aap.systolic || dbp >= aap.diastolic));
      interp = flagged
        ? interpret(LEVEL.DANGER, `${fmt(sbp)}/${fmt(dbp)} mmHg — exceeds a simplified threshold`, hcVerdict)
        : interpret(LEVEL.INFO, `${fmt(sbp)}/${fmt(dbp)} mmHg`, hcVerdict);
    }

    warnings.push(interpret(LEVEL.INFO, `Hypertension Canada: ${hcVerdict}`));
    warnings.push(interpret(LEVEL.INFO, `AAP 2017: ${aapVerdict}`));

    if (v.percentile !== undefined && v.percentile !== '' && Number(v.percentile) >= 95) {
      // severe range guidance
      warnings.push(interpret(LEVEL.WARN,
        'If BP is 30 mmHg or more above the 95th percentile, treat as hypertensive urgency/emergency: reduce BP by no more than 25% of the planned reduction over the first 8 hours, then the remainder over 12–24 hours.'));
    }

    return {
      value: map, unit: 'mmHg', label: 'Mean arterial pressure',
      steps, extra, warnings, interpretation: interp,
    };
  },
  considerations: [
    'THE TWO GUIDELINES DIFFER FOR ADOLESCENTS. Hypertension Canada uses >130/85 for ages 12–17; AAP 2017 uses ≥130/80 from age 13. Both are shown here rather than silently reconciled — follow your local protocol.',
    'A single reading never diagnoses hypertension. Both guidelines require elevation on 3 separate occasions.',
    'Measurement protocol: if the initial reading is ≥90th percentile, take 2 further measurements at the same visit and average them. If an averaged oscillometric reading is ≥90th percentile, confirm with 2 auscultatory measurements.',
    'Use the right arm, with a correctly sized cuff. The right arm is the reference for normative data and avoids missing coarctation.',
    'Full percentile classification needs the AAP age/sex/height tables and a height percentile; those tables are pending extraction from the handbook PDF. Enter a looked-up percentile above to classify properly in the meantime.',
    'ABPM is more accurate than office BP, more predictive of future BP, and recommended routinely where available — particularly in CKD, dialysis, and transplant patients. It is generally limited to children 5 years and older.',
    'Treatment target is below the 90th percentile, and below 130/80 in adolescents 13 and over.',
  ],
  references: [
    'CAPN Paediatric Nephrology Resident Handbook, 1st ed. 2021, ch.7.',
    'Hypertension Canada 2020 Comprehensive Guidelines. Can J Cardiol 2020;36:596-624.',
    'Flynn JT et al. AAP Clinical Practice Guideline. Pediatrics 2017;140:e20171904.',
  ],
};

export const calculators = [bloodPressureClassification];
