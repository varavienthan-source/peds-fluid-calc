import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anionGap, compensation, urineAnionGap } from '../src/calc/acidbase.js';

test('HANDBOOK: anion gap = Na - (Cl + HCO3), normal 8-12', () => {
  assert.equal(anionGap.compute({ sodium: 140, chloride: 105, bicarbonate: 25 }).value, 10);
  assert.equal(anionGap.compute({ sodium: 140, chloride: 105, bicarbonate: 25 }).interpretation.level, 'normal');
  assert.equal(anionGap.compute({ sodium: 140, chloride: 100, bicarbonate: 10 }).interpretation.level, 'warn');
});

test('albumin correction raises the gap by 0.25 per g/L below 40', () => {
  // albumin 20 -> +5
  const r = anionGap.compute({ sodium: 140, chloride: 110, bicarbonate: 20, albumin: 20 });
  assert.equal(r.value, 15);
  const uncorrected = r.extra.find((e) => e.label === 'Anion gap');
  assert.equal(uncorrected.value, '10');
});

test('normal gap with low bicarbonate points to the urine anion gap', () => {
  const r = anionGap.compute({ sodium: 140, chloride: 115, bicarbonate: 15 });
  assert.match(r.interpretation.detail, /urine anion gap/);
});

test("HANDBOOK: Winters' formula for metabolic acidosis", () => {
  const r = compensation.compute({ bicarbonate: 14, pco2: 29, disorder: 'acidosis' });
  assert.equal(r.value, 29);
  assert.equal(r.interpretation.level, 'normal');
});

test('metabolic acidosis with low pCO2 flags concurrent respiratory alkalosis', () => {
  const r = compensation.compute({ bicarbonate: 14, pco2: 20, disorder: 'acidosis' });
  assert.match(r.interpretation.text, /respiratory alkalosis/);
});

test('metabolic acidosis with high pCO2 flags concurrent respiratory acidosis', () => {
  const r = compensation.compute({ bicarbonate: 14, pco2: 45, disorder: 'acidosis' });
  assert.match(r.interpretation.text, /respiratory acidosis/);
});

test('HANDBOOK: metabolic alkalosis compensation is 0.7 x HCO3 + 20', () => {
  const r = compensation.compute({ bicarbonate: 40, pco2: 48, disorder: 'alkalosis' });
  assert.equal(r.value, 48);
  assert.equal(r.interpretation.level, 'normal');
});

test('HANDBOOK: urine anion gap and the neGUTive mnemonic', () => {
  const gut = urineAnionGap.compute({ urineNa: 40, urineK: 20, urineCl: 80 });
  assert.equal(gut.value, -20);
  assert.match(gut.interpretation.text, /neGUTive/);
  assert.match(gut.interpretation.detail, /GI bicarbonate loss/);

  const rta = urineAnionGap.compute({ urineNa: 60, urineK: 30, urineCl: 50 });
  assert.equal(rta.value, 40);
  assert.match(rta.interpretation.detail, /renal tubular acidosis/i);
});

test('UAG considerations name the confounders that invalidate it', () => {
  const text = urineAnionGap.considerations.join(' ');
  assert.match(text, /DKA/);
  assert.match(text, /osmolal gap/);
});
