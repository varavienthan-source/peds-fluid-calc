import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schwartzSI, ckidU25K, ckdStage, bedsideSchwartz, ckidU25, creatinineClearance } from '../src/calc/egfr.js';

test('HANDBOOK: bedside Schwartz uses the SI constant 36.5', () => {
  assert.ok(/36\.5/.test(bedsideSchwartz.formula));
  // 36.5 * 110 / 40 = 100.375
  assert.ok(Math.abs(schwartzSI(110, 40) - 100.375) < 1e-6);
});

test('SI form is algebraically identical to the classic 0.413 mg/dL form', () => {
  for (const [h, crUmol] of [[110, 40], [150, 88.4], [80, 25], [170, 300]]) {
    const si = schwartzSI(h, crUmol);
    const classic = (0.413 * h) / (crUmol / 88.4);
    assert.ok(Math.abs(si - classic) / classic < 0.001,
      `height ${h}, Cr ${crUmol}: SI ${si} vs classic ${classic}`);
  }
});

test('entering creatinine in mg/dL gives the same answer as µmol/L', () => {
  const si = bedsideSchwartz.compute({ height: 120, creatinine: 88.4 });
  const conv = bedsideSchwartz.compute({ height: 120, creatinine: 1, creatinineUnit: 'mg/dL' });
  assert.ok(Math.abs(si.value - conv.value) < 1e-6, 'dual-unit entry must agree');
  assert.ok(conv.steps.some((s) => /Convert creatinine to SI/.test(s.label)),
    'the conversion must be shown as a visible step');
});

test('CKiD U25 k coefficients match Pierce 2021 at the band anchors', () => {
  // At exactly age 12 the exponent is zero, so k is the base constant.
  assert.ok(Math.abs(ckidU25K(12, 'male') - 39.0) < 1e-9);
  assert.ok(Math.abs(ckidU25K(12, 'female') - 36.1) < 1e-9);
  assert.equal(ckidU25K(18, 'male'), 50.8);
  assert.equal(ckidU25K(18, 'female'), 41.4);
  assert.equal(ckidU25K(25, 'male'), 50.8);
});

test('CKiD U25 k is continuous across the 12-year boundary', () => {
  const below = ckidU25K(11.999, 'male');
  const above = ckidU25K(12.001, 'male');
  assert.ok(Math.abs(below - above) < 0.01, `k jumps at age 12: ${below} vs ${above}`);
});

test('CKiD U25 k rises with age in the adolescent band', () => {
  assert.ok(ckidU25K(17, 'male') > ckidU25K(13, 'male'));
  assert.ok(ckidU25K(17, 'female') > ckidU25K(13, 'female'));
});

test('CKiD U25 male k exceeds female k at the same age', () => {
  for (const age of [5, 10, 14, 20]) {
    assert.ok(ckidU25K(age, 'male') > ckidU25K(age, 'female'), `age ${age}`);
  }
});

test('KDIGO GFR categories sit on the right side of every boundary', () => {
  assert.equal(ckdStage(90).stage, 'G1');
  assert.equal(ckdStage(89.9).stage, 'G2');
  assert.equal(ckdStage(60).stage, 'G2');
  assert.equal(ckdStage(59.9).stage, 'G3a');
  assert.equal(ckdStage(45).stage, 'G3a');
  assert.equal(ckdStage(44.9).stage, 'G3b');
  assert.equal(ckdStage(30).stage, 'G3b');
  assert.equal(ckdStage(29.9).stage, 'G4');
  assert.equal(ckdStage(15).stage, 'G4');
  assert.equal(ckdStage(14.9).stage, 'G5');
});

test('under 1 year, Schwartz warns it is not valid', () => {
  const r = bedsideSchwartz.compute({ height: 55, creatinine: 30, age: 0.5 });
  assert.ok(r.warnings.some((w) => w.level === 'danger' && /Under 1 year/.test(w.text)));
});

test('at 18 and over, Schwartz points to CKiD U25 or CKD-EPI', () => {
  const r = bedsideSchwartz.compute({ height: 170, creatinine: 80, age: 19 });
  assert.ok(r.warnings.some((w) => /CKiD U25/.test(w.text)));
});

test('eGFR below 50 prompts a drug dose review', () => {
  const r = bedsideSchwartz.compute({ height: 100, creatinine: 150 });
  assert.ok(r.value < 50);
  assert.ok(r.warnings.some((w) => /renally excreted drugs/.test(w.text)));
});

test('creatinine clearance normalises to 1.73 m²', () => {
  // ucr 8000, vol 1000 mL, 24 hr = 1440 min, pcr 80 -> (8000*1000)/(80*1440) = 69.44 mL/min
  // BSA 1.0 -> x1.73 = 120.1
  const r = creatinineClearance.compute({
    urineCr: 8000, urineVolume: 1000, hours: 24, plasmaCr: 80, bsa: 1.0,
  });
  assert.ok(Math.abs(r.value - 120.14) < 0.5, `got ${r.value}`);
});
