import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSI, toConventional, normalise, ANALYTES, unitOptions } from '../src/units.js';
import { evaluate } from '../src/expression.js';

test('creatinine converts on the 88.4 factor', () => {
  assert.ok(Math.abs(toSI('creatinine', 1) - 88.4) < 1e-9);
  assert.ok(Math.abs(toConventional('creatinine', 88.4) - 1) < 1e-9);
});

test('BUN mg/dL to urea mmol/L uses 2.8', () => {
  assert.ok(Math.abs(toConventional('urea', 10) - 28) < 1e-6, '10 mmol/L urea = 28 mg/dL BUN');
});

test('proteinuria ratios convert on 8.84', () => {
  assert.ok(Math.abs(toConventional('proteinCr', 250) - 2210) < 1, '250 mg/mmol is ~2210 mg/g');
  assert.ok(Math.abs(toSI('albuminCr', 30) - 3.39) < 0.01, 'KDIGO 30 mg/g is ~3.4 mg/mmol');
});

test('urine calcium/creatinine converts on 2.82', () => {
  assert.ok(Math.abs(toSI('calciumCr', 0.2) - 0.564) < 0.01);
});

test('every conversion round-trips', () => {
  for (const key of Object.keys(ANALYTES)) {
    const there = toSI(key, 7);
    const back = toConventional(key, there);
    assert.ok(Math.abs(back - 7) < 1e-9, `${key} failed to round-trip`);
  }
});

test('normalise records the conversion for display', () => {
  const n = normalise('creatinine', 1, 'mg/dL');
  assert.equal(n.converted, true);
  assert.deepEqual(n.from, { value: 1, unit: 'mg/dL' });

  const already = normalise('creatinine', 88.4, 'µmol/L');
  assert.equal(already.converted, false);
});

test('an unrecognised unit is rejected rather than silently assumed', () => {
  assert.throws(() => normalise('creatinine', 1, 'mg/L'), /not valid for creatinine/);
  assert.throws(() => toSI('unobtainium', 1), /Unknown analyte/);
});

test('analytes with identical units offer a single option', () => {
  assert.deepEqual(unitOptions('cystatinC'), ['mg/L']);
  assert.equal(unitOptions('creatinine').length, 2);
});

test('expression evaluator respects precedence and associativity', () => {
  assert.equal(evaluate('2+3*4'), 14);
  assert.equal(evaluate('(2+3)*4'), 20);
  assert.equal(evaluate('2^3^2'), 512, 'exponent is right-associative');
  assert.equal(evaluate('-5+3'), -2);
  assert.equal(evaluate('3*(-2)'), -6);
});

test('expression evaluator normalises display glyphs', () => {
  assert.equal(evaluate('6 ÷ 3'), 2);
  assert.equal(evaluate('4 × 5'), 20);
  assert.equal(evaluate('9 − 4'), 5);
});

test('expression evaluator rejects malformed input instead of guessing', () => {
  for (const bad of ['', '((1+2)', '1++', '2+*3', '1.2.3', 'alert(1)']) {
    assert.throws(() => evaluate(bad), `"${bad}" should be rejected`);
  }
});

test('expression evaluator rejects division producing infinity', () => {
  assert.throws(() => evaluate('1/0'), /finite/);
});
