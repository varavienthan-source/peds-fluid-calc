import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kdigoStaging, fractionalExcretion, fluidOverload } from '../src/calc/aki.js';

test('HANDBOOK: KDIGO stage 1 at a 26 µmol/L rise, independent of fold change', () => {
  // Baseline chosen so the fold-change criterion is NOT met (1.26x), isolating the absolute rise.
  const r = kdigoStaging.compute({ baselineCr: 100, currentCr: 126 });
  assert.equal(r.value, 1, 'a 26 µmol/L rise alone reaches stage 1');
  const r2 = kdigoStaging.compute({ baselineCr: 100, currentCr: 125 });
  assert.equal(r2.value, 0, 'a 25 µmol/L rise at 1.25x baseline meets neither criterion');
});

test('either KDIGO criterion alone is sufficient for stage 1', () => {
  // fold change met, absolute rise not (1.5x but only 10 µmol/L)
  assert.equal(kdigoStaging.compute({ baselineCr: 20, currentCr: 30 }).value, 1);
});

test('KDIGO creatinine fold-change boundaries', () => {
  assert.equal(kdigoStaging.compute({ baselineCr: 100, currentCr: 150 }).value, 1);
  assert.equal(kdigoStaging.compute({ baselineCr: 100, currentCr: 200 }).value, 2);
  assert.equal(kdigoStaging.compute({ baselineCr: 100, currentCr: 300 }).value, 3);
});

test('HANDBOOK: paediatric stage 3 uses eGFR below 35, not the adult 353 µmol/L', () => {
  const r = kdigoStaging.compute({ baselineCr: 40, currentCr: 70, age: 8, egfr: 30 });
  assert.equal(r.value, 3);
  assert.match(r.extra.find((e) => e.label === 'Stage by creatinine').unit, /eGFR <35/);
});

test('adult creatinine threshold applies at 18 and over', () => {
  const r = kdigoStaging.compute({ baselineCr: 200, currentCr: 360, age: 19 });
  assert.equal(r.value, 3);
});

test('urine output arm stages independently and the worse arm wins', () => {
  assert.equal(kdigoStaging.compute({ baselineCr: 40, currentCr: 40, urineOutput: 0.4, urineHours: 7 }).value, 1);
  assert.equal(kdigoStaging.compute({ baselineCr: 40, currentCr: 40, urineOutput: 0.4, urineHours: 13 }).value, 2);
  assert.equal(kdigoStaging.compute({ baselineCr: 40, currentCr: 40, urineOutput: 0.2, urineHours: 25 }).value, 3);
  assert.equal(kdigoStaging.compute({ baselineCr: 40, currentCr: 40, urineOutput: 0, urineHours: 13 }).value, 3);

  // creatinine says stage 1, urine output says stage 3 -> stage 3
  const mixed = kdigoStaging.compute({ baselineCr: 40, currentCr: 66, urineOutput: 0, urineHours: 14 });
  assert.equal(mixed.value, 3);
});

test('FENa matches the handbook formula', () => {
  // 100 * (10 * 80) / (140 * 8000) = 100 * 800/1120000 = 0.0714%
  const r = fractionalExcretion.compute({ urineNa: 10, serumNa: 140, urineCr: 8000, serumCr: 80 });
  assert.ok(Math.abs(r.value - 0.0714) < 0.001);
  assert.match(r.interpretation.text, /pre-renal/);
});

test('FENa classification bands', () => {
  const intrinsic = fractionalExcretion.compute({ urineNa: 60, serumNa: 140, urineCr: 2000, serumCr: 100 });
  assert.ok(intrinsic.value > 2);
  assert.match(intrinsic.interpretation.text, /intrinsic/);
});

test('neonates get the raised FENa threshold', () => {
  const r = fractionalExcretion.compute({ urineNa: 40, serumNa: 140, urineCr: 3000, serumCr: 90, neonate: true });
  assert.ok(r.warnings.some((w) => /tubular immaturity/.test(w.text)));
});

test('diuretics invalidate FENa and the app says so', () => {
  const r = fractionalExcretion.compute({ urineNa: 10, serumNa: 140, urineCr: 8000, serumCr: 80, onDiuretics: true });
  assert.ok(r.warnings.some((w) => w.level === 'danger' && /FEUrea/.test(w.text)));
});

test('percent fluid overload matches the published formula', () => {
  // (5000 - 3000) mL = 2 L over 20 kg = 10%
  const r = fluidOverload.compute({ fluidIn: 5000, fluidOut: 3000, baselineWeight: 20 });
  assert.ok(Math.abs(r.value - 10) < 1e-9);
  assert.equal(r.interpretation.level, 'danger');
});

test('20% fluid overload carries the mortality note', () => {
  const r = fluidOverload.compute({ fluidIn: 8000, fluidOut: 4000, baselineWeight: 20 });
  assert.ok(Math.abs(r.value - 20) < 1e-9);
  assert.match(r.interpretation.detail, /threefold/);
});

test('balance and weight methods disagreeing raises a data-quality warning', () => {
  const r = fluidOverload.compute({ fluidIn: 5000, fluidOut: 3000, baselineWeight: 20, currentWeight: 25 });
  assert.ok(r.warnings.some((w) => /unrecorded intake or output/.test(w.text)));
});
