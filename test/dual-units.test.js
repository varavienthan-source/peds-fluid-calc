import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYTES } from '../src/units.js';
import { bedsideSchwartz, ckidU25, creatinineClearance } from '../src/calc/egfr.js';
import { kdigoStaging, fractionalExcretion } from '../src/calc/aki.js';
import { correctedCalcium, serumOsmolality } from '../src/calc/electrolytes.js';
import { anionGap } from '../src/calc/acidbase.js';
import { proteinCreatinineRatio, albuminCreatinineRatio } from '../src/calc/proteinuria.js';

/**
 * Regression guard: range bounds are expressed in SI, so validation MUST run
 * after unit normalisation. Checking the raw value rejects legitimate
 * conventional-unit entries (0.45 mg/dL creatinine is a normal toddler value).
 */

const conv = (analyte, si) => si / ANALYTES[analyte].factor;

test('a normal toddler creatinine entered in mg/dL is accepted, not rejected', () => {
  // 40 µmol/L is a normal toddler creatinine; in mg/dL that is 0.4525.
  const r = bedsideSchwartz.compute({ height: 90, creatinine: conv('creatinine', 40), creatinineUnit: 'mg/dL' });
  assert.ok(r.value > 0, 'must compute rather than throw a range error');
});

test('bedside Schwartz agrees across units', () => {
  const si = bedsideSchwartz.compute({ height: 110, creatinine: 40 });
  const cv = bedsideSchwartz.compute({ height: 110, creatinine: conv('creatinine', 40), creatinineUnit: 'mg/dL' });
  assert.ok(Math.abs(si.value - cv.value) < 1e-9);
});

test('CKiD U25 agrees across units', () => {
  const si = ckidU25.compute({ height: 150, creatinine: 90, age: 14, sex: 'male' });
  const cv = ckidU25.compute({ height: 150, creatinine: conv('creatinine', 90), creatinineUnit: 'mg/dL', age: 14, sex: 'male' });
  assert.ok(Math.abs(si.value - cv.value) < 1e-9);
});

test('creatinine clearance agrees across units', () => {
  const base = { urineCr: 8000, urineVolume: 1000, hours: 24, bsa: 1.0 };
  const si = creatinineClearance.compute({ ...base, plasmaCr: 80 });
  const cv = creatinineClearance.compute({ ...base, plasmaCr: conv('creatinine', 80), plasmaCrUnit: 'mg/dL' });
  assert.ok(Math.abs(si.value - cv.value) < 1e-9);
});

test('KDIGO staging agrees across units', () => {
  const si = kdigoStaging.compute({ baselineCr: 40, currentCr: 120 });
  const cv = kdigoStaging.compute({
    baselineCr: conv('creatinine', 40), baselineCrUnit: 'mg/dL',
    currentCr: conv('creatinine', 120), currentCrUnit: 'mg/dL',
  });
  assert.equal(si.value, cv.value);
});

test('FENa agrees across units', () => {
  const base = { urineNa: 20, serumNa: 140, urineCr: 5000 };
  const si = fractionalExcretion.compute({ ...base, serumCr: 90 });
  const cv = fractionalExcretion.compute({ ...base, serumCr: conv('creatinine', 90), serumCrUnit: 'mg/dL' });
  assert.ok(Math.abs(si.value - cv.value) < 1e-9);
});

test('corrected calcium agrees across units', () => {
  const si = correctedCalcium.compute({ calcium: 2.0, albumin: 20 });
  const cv = correctedCalcium.compute({
    calcium: conv('calcium', 2.0), calciumUnit: 'mg/dL',
    albumin: conv('albumin', 20), albuminUnit: 'g/dL',
  });
  assert.ok(Math.abs(si.value - cv.value) < 1e-9);
});

test('serum osmolality agrees across units', () => {
  const si = serumOsmolality.compute({ sodium: 140, glucose: 5, urea: 5 });
  const cv = serumOsmolality.compute({
    sodium: 140,
    glucose: conv('glucose', 5), glucoseUnit: 'mg/dL',
    urea: conv('urea', 5), ureaUnit: 'mg/dL',
  });
  assert.ok(Math.abs(si.value - cv.value) < 1e-9);
});

test('albumin-corrected anion gap agrees across units', () => {
  const si = anionGap.compute({ sodium: 140, chloride: 110, bicarbonate: 20, albumin: 20 });
  const cv = anionGap.compute({
    sodium: 140, chloride: 110, bicarbonate: 20,
    albumin: conv('albumin', 20), albuminUnit: 'g/dL',
  });
  assert.ok(Math.abs(si.value - cv.value) < 1e-9);
});

test('PCR and ACR agree across units', () => {
  const pSi = proteinCreatinineRatio.compute({ mode: 'ratio', ratio: 250, age: 5 });
  const pCv = proteinCreatinineRatio.compute({ mode: 'ratio', ratio: conv('proteinCr', 250), ratioUnit: 'mg/g', age: 5 });
  assert.ok(Math.abs(pSi.value - pCv.value) < 1e-9);

  const aSi = albuminCreatinineRatio.compute({ ratio: 30 });
  const aCv = albuminCreatinineRatio.compute({ ratio: conv('albuminCr', 30), ratioUnit: 'mg/g' });
  assert.ok(Math.abs(aSi.value - aCv.value) < 1e-9);
});

test('out-of-range values are still rejected, in either unit', () => {
  assert.throws(() => bedsideSchwartz.compute({ height: 110, creatinine: 99999 }), /Creatinine/);
  assert.throws(
    () => bedsideSchwartz.compute({ height: 110, creatinine: 9999, creatinineUnit: 'mg/dL' }),
    /Creatinine/,
    'an absurd mg/dL value must still be caught after conversion'
  );
});
