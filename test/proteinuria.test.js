import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proteinCreatinineRatio, albuminCreatinineRatio, proteinuria24h, nephroticSteroids } from '../src/calc/proteinuria.js';

test('HANDBOOK: PCR normal threshold is age-dependent (50 under 2 y, 20 over)', () => {
  const infant = proteinCreatinineRatio.compute({ mode: 'ratio', ratio: 30, age: 1 });
  assert.equal(infant.interpretation.level, 'normal', '30 mg/mmol is normal under 2 years');

  const child = proteinCreatinineRatio.compute({ mode: 'ratio', ratio: 30, age: 5 });
  assert.equal(child.interpretation.level, 'warn', '30 mg/mmol is abnormal over 2 years');
});

test('HANDBOOK: PCR nephrotic threshold is 250 mg/mmol', () => {
  assert.equal(proteinCreatinineRatio.compute({ mode: 'ratio', ratio: 251, age: 5 }).interpretation.level, 'danger');
  assert.equal(proteinCreatinineRatio.compute({ mode: 'ratio', ratio: 249, age: 5 }).interpretation.level, 'warn');
});

test('PCR accepts US mg/g and converts, showing the step', () => {
  const r = proteinCreatinineRatio.compute({ mode: 'ratio', ratio: 2210, ratioUnit: 'mg/g', age: 5 });
  assert.ok(Math.abs(r.value - 250) < 1, `2210 mg/g should be ~250 mg/mmol, got ${r.value}`);
  assert.ok(r.steps.some((s) => /Convert to SI/.test(s.label)));
});

test('PCR computed from components equals protein / creatinine', () => {
  const r = proteinCreatinineRatio.compute({ mode: 'components', protein: 1000, creatinine: 5, age: 5 });
  assert.equal(r.value, 200);
});

test('HANDBOOK: ACR bands are 2.5 / 20 / 220 mg/mmol', () => {
  assert.equal(albuminCreatinineRatio.compute({ ratio: 2 }).interpretation.level, 'normal');
  assert.equal(albuminCreatinineRatio.compute({ ratio: 10 }).interpretation.level, 'warn');
  assert.match(albuminCreatinineRatio.compute({ ratio: 10 }).interpretation.detail, /A2/);
  assert.match(albuminCreatinineRatio.compute({ ratio: 100 }).interpretation.detail, /A3/);
  assert.equal(albuminCreatinineRatio.compute({ ratio: 300 }).interpretation.level, 'danger');
});

test('HANDBOOK: 24-hour protein normal <100, nephrotic >1000 mg/m²/day', () => {
  // BSA for 110 cm / 20 kg is 0.782 m^2
  const normal = proteinuria24h.compute({ totalProtein: 60, height: 110, weight: 20 });
  assert.equal(normal.interpretation.level, 'normal');
  const nephrotic = proteinuria24h.compute({ totalProtein: 900, height: 110, weight: 20 });
  assert.equal(nephrotic.interpretation.level, 'danger');
});

test('HANDBOOK: prednisone is 60 mg/m²/day capped at 60 mg', () => {
  // BSA 0.782 -> 46.9 mg
  const small = nephroticSteroids.compute({ height: 110, weight: 20 });
  assert.ok(Math.abs(small.value - 46.9) < 0.2, `got ${small.value}`);

  // A large adolescent must be capped
  const large = nephroticSteroids.compute({ height: 175, weight: 70 });
  assert.equal(large.value, 60, 'daily dose is capped at 60 mg');
  assert.ok(large.warnings.some((w) => /capped at 60/.test(w.text)));
});

test('alternate-day taper dose is 40 mg/m² capped at 40 mg', () => {
  const large = nephroticSteroids.compute({ height: 175, weight: 70 });
  const alt = large.extra.find((e) => e.label === 'Alternate-day taper');
  assert.equal(alt.value, '40');
});

test('albumin dosing carries the pulmonary oedema caution', () => {
  const r = nephroticSteroids.compute({ height: 110, weight: 20 });
  assert.ok(r.warnings.some((w) => /pulmonary edema/i.test(w.text)));
});

test('PCR considerations warn explicitly about unit confusion', () => {
  assert.ok(proteinCreatinineRatio.considerations.some((c) => /CHECK YOUR UNITS/.test(c)));
});
