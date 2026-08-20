import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sodiumDeficit, freeWaterDeficit, serumOsmolality, correctedCalcium, ttkg, hyperkalemiaDosing } from '../src/calc/electrolytes.js';

test('HANDBOOK WORKED EXAMPLE: Na deficit, 10 kg, Na 112 -> 120', () => {
  const r = sodiumDeficit.compute({
    weight: 10, currentNa: 112, desiredNa: 120, hours: 24, fluid: 'ns', includeMaintenance: true,
  });
  const deficit = r.extra.find((e) => e.label === 'Sodium deficit');
  assert.equal(deficit.value, '48', 'handbook states a 48 mmol deficit');

  const rate = r.extra.find((e) => e.label === 'Deficit replacement rate');
  assert.ok(Math.abs(Number(rate.value) - 13) < 0.5, `handbook states ~13 mL/hr, got ${rate.value}`);

  const maint = r.extra.find((e) => e.label === 'Maintenance Na');
  assert.equal(maint.value, '20', 'handbook uses 2 mmol/kg/day = 20 mmol');
});

test('sodium correction faster than 8 mmol/L/24hr is flagged as dangerous', () => {
  const r = sodiumDeficit.compute({ weight: 10, currentNa: 110, desiredNa: 130, hours: 24, fluid: 'ns' });
  assert.ok(r.warnings.some((w) => w.level === 'danger' && /8 mmol/.test(w.text)));
});

test('sodium below 125 prompts hypertonic saline guidance', () => {
  const r = sodiumDeficit.compute({ weight: 10, currentNa: 118, desiredNa: 125, hours: 24, fluid: 'ns' });
  assert.ok(r.warnings.some((w) => /3% NaCl 2–3 mL\/kg/.test(w.text)));
});

test('HANDBOOK WORKED EXAMPLE: free water deficit, 9 kg, Na 174 -> 145', () => {
  const r = freeWaterDeficit.compute({ weight: 9, currentNa: 174, desiredNa: 145 });
  assert.ok(Math.abs(r.value - 1080) < 1, `handbook states 1080 mL, got ${r.value}`);

  const cross = r.extra.find((e) => e.label === 'Rule-of-thumb cross-check');
  assert.equal(cross.value, '1044', 'handbook cross-check is 1044 mL (4 mL/kg x 29)');
});

test('free water deficit uses the desired Na as denominator, per the handbook', () => {
  // 0.6 * 10 * ((160-140)/140) = 6 * 0.142857 = 0.857 L
  const r = freeWaterDeficit.compute({ weight: 10, currentNa: 160, desiredNa: 140 });
  assert.ok(Math.abs(r.value - 857.14) < 1, `expected ~857 mL, got ${r.value}`);
});

test('severe hypernatremia warns about correction rate', () => {
  const r = freeWaterDeficit.compute({ weight: 10, currentNa: 168, desiredNa: 145 });
  assert.ok(r.warnings.some((w) => w.level === 'danger' && /8–10 mmol/.test(w.text)));
});

test('serum osmolality uses the SI form 2Na + glucose + urea', () => {
  const r = serumOsmolality.compute({ sodium: 140, glucose: 5, urea: 5 });
  assert.equal(r.value, 290);
});

test('osmolal gap above 10 is flagged', () => {
  const r = serumOsmolality.compute({ sodium: 140, glucose: 5, urea: 5, measured: 320 });
  assert.ok(r.warnings.some((w) => /Osmolal gap/.test(w.text)));
});

test('corrected calcium adds 0.02 per g/L of albumin below 40', () => {
  // albumin 20 => +0.4
  const r = correctedCalcium.compute({ calcium: 2.0, albumin: 20 });
  assert.ok(Math.abs(r.value - 2.4) < 1e-9);
});

test('normal albumin needs no correction', () => {
  const r = correctedCalcium.compute({ calcium: 2.3, albumin: 40 });
  assert.equal(r.value, 2.3);
  assert.ok(r.warnings.some((w) => /no correction/i.test(w.text)));
});

test('TTKG is rejected when urine osmolality does not exceed plasma', () => {
  const r = ttkg.compute({ urineK: 40, plasmaK: 4, urineOsm: 250, plasmaOsm: 290 });
  assert.ok(r.warnings.some((w) => w.level === 'danger' && /INVALID/.test(w.text)));
});

test('TTKG is rejected when urine sodium is below 20', () => {
  const r = ttkg.compute({ urineK: 40, plasmaK: 4, urineOsm: 600, plasmaOsm: 290, urineNa: 10 });
  assert.ok(r.warnings.some((w) => /urine sodium/.test(w.text)));
});

test('TTKG computes and classifies against the handbook cut-off of 6', () => {
  // (40/4) * (290/600) = 10 * 0.4833 = 4.83 -> impaired
  const r = ttkg.compute({ urineK: 40, plasmaK: 4, urineOsm: 600, plasmaOsm: 290, urineNa: 40 });
  assert.ok(Math.abs(r.value - 4.833) < 0.01);
  assert.match(r.interpretation.text, /impaired aldosterone/);
});

test('hyperkalemia calcium gluconate is capped at 2000 mg', () => {
  const r = hyperkalemiaDosing.compute({ weight: 60 });
  // 100 mg/kg would be 6000 mg; must cap at 2000 mg = 20 mL
  const ca = r.extra.find((e) => e.label === 'Calcium gluconate 10%');
  assert.ok(ca.value.endsWith('20'), `expected upper bound 20 mL, got ${ca.value}`);
});

test('hyperkalemia bicarbonate is capped at 50 mmol', () => {
  const r = hyperkalemiaDosing.compute({ weight: 80, acidotic: true });
  const bicarb = r.extra.find((e) => e.label === 'Sodium bicarbonate (if acidotic)');
  assert.equal(bicarb.value, '50');
});

test('potassium at or above 7 triggers a danger warning', () => {
  const r = hyperkalemiaDosing.compute({ weight: 20, potassium: 7.2 });
  assert.ok(r.warnings.some((w) => w.level === 'danger' && /dialysis/.test(w.text)));
});
