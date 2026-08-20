import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hollidaySegarRate, hollidaySegarDaily, bagSize, maintenance421, deficitReplacement } from '../src/calc/fluids.js';

test('4-2-1 band edges are exact', () => {
  assert.equal(hollidaySegarRate(10), 40, 'exactly 10 kg stays in the 4 mL/kg band');
  assert.equal(hollidaySegarRate(10.1), 40.2);
  assert.equal(hollidaySegarRate(20), 60, 'exactly 20 kg stays in the 2 mL/kg band');
  assert.equal(hollidaySegarRate(20.1), 60.1);
  assert.equal(hollidaySegarRate(5), 20);
  assert.equal(hollidaySegarRate(15), 50);
  assert.equal(hollidaySegarRate(30), 70);
});

test('4-2-1 daily volumes follow 100/50/20', () => {
  assert.equal(hollidaySegarDaily(10), 1000);
  assert.equal(hollidaySegarDaily(20), 1500);
  assert.equal(hollidaySegarDaily(30), 1700);
});

test('non-positive weight yields zero rate', () => {
  assert.equal(hollidaySegarRate(0), 0);
  assert.equal(hollidaySegarRate(-5), 0);
});

test('bag size steps at 40 and 80 mL/hr', () => {
  assert.equal(bagSize(40), 250);
  assert.equal(bagSize(40.1), 500);
  assert.equal(bagSize(80), 500);
  assert.equal(bagSize(80.1), 1000);
});

test('weight under 1 kg is blocked, not silently computed', () => {
  assert.throws(() => maintenance421.compute({ weight: 0.8 }), /Neonatology/);
});

test('weight over 70 kg warns about adult dosing', () => {
  const r = maintenance421.compute({ weight: 80 });
  assert.ok(r.warnings.some((w) => /adult dosing/i.test(w.text)));
});

test('age zero is accepted — a newborn must render', () => {
  const r = deficitReplacement.compute({ weight: 3.5, dehydration: '5' });
  assert.ok(r.value > 0);
});

test('deficit halves split 8 hr / 16 hr correctly', () => {
  // 10 kg, 10% dehydration => 1000 mL deficit; half = 500; /8 = 62.5, /16 = 31.25
  const r = deficitReplacement.compute({ weight: 10, dehydration: '10' });
  const maint = hollidaySegarRate(10); // 40
  assert.equal(r.value, maint + 62.5);
  const sixteen = r.extra.find((e) => e.label === 'Rate hours 8–24');
  assert.ok(Math.abs(parseFloat(sixteen.value) - (maint + 31.25)) < 0.1,
    `expected ~${maint + 31.25} mL/hr, got ${sixteen.value}`);
});

test('severe dehydration triggers a bolus warning', () => {
  const r = deficitReplacement.compute({ weight: 10, dehydration: '15' });
  assert.ok(r.warnings.some((w) => /bolus/i.test(w.text)));
});

test('every fluids calculator states its caveats and formula', () => {
  for (const calc of [maintenance421, deficitReplacement]) {
    assert.ok(calc.formula, `${calc.id} has a formula`);
    assert.ok(calc.considerations.length >= 3, `${calc.id} has considerations`);
  }
  assert.ok(
    maintenance421.considerations.some((c) => /not always the right answer|WARNS AGAINST/i.test(c)),
    'the handbook warning against defaulting to 4-2-1 is surfaced'
  );
});
