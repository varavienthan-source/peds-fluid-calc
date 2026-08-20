/** Body size and growth calculations. */
'use strict';

import { fmt } from '../fmt.js';
import { step, interpret, LEVEL, requirePositive, requireRange } from '../descriptor.js';

/** Mosteller BSA (m^2). The general-purpose default. */
export function bsaMosteller(heightCm, weightKg) {
  return Math.sqrt((heightCm * weightKg) / 3600);
}

/** Haycock BSA (m^2). Derived in infants and children; preferred at low body mass. */
export function bsaHaycock(heightCm, weightKg) {
  return 0.024265 * Math.pow(heightCm, 0.3964) * Math.pow(weightKg, 0.5378);
}

/** Du Bois BSA (m^2). Included for comparison; least suited to small children. */
export function bsaDuBois(heightCm, weightKg) {
  return 0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);
}

export const bodySurfaceArea = {
  id: 'bsa',
  category: 'Growth & body size',
  title: 'Body Surface Area',
  source: 'Mosteller NEJM 1987; Haycock J Pediatr 1978',
  formula: 'Mosteller: BSA (m²) = √(height(cm) × weight(kg) / 3600)',
  inputs: [
    { key: 'height', label: 'Height / length', unit: 'cm', min: 20, max: 220, step: 0.1 },
    { key: 'weight', label: 'Weight', unit: 'kg', min: 0.4, max: 200, step: 0.01 },
    {
      key: 'method', label: 'Formula', type: 'select', default: 'mosteller',
      options: [
        { value: 'mosteller', label: 'Mosteller (default)' },
        { value: 'haycock', label: 'Haycock (infants / small children)' },
        { value: 'dubois', label: 'Du Bois' },
      ],
    },
  ],
  compute(v) {
    const h = requireRange(v.height, 20, 220, 'Height', 'height');
    const w = requireRange(v.weight, 0.4, 200, 'Weight', 'weight');
    const method = v.method || 'mosteller';

    const steps = [];
    let bsa;
    if (method === 'haycock') {
      bsa = bsaHaycock(h, w);
      steps.push(step('Apply Haycock', `0.024265 × ${fmt(h)}^0.3964 × ${fmt(w, 2)}^0.5378`, `${fmt(bsa, 3)} m²`));
    } else if (method === 'dubois') {
      bsa = bsaDuBois(h, w);
      steps.push(step('Apply Du Bois', `0.007184 × ${fmt(h)}^0.725 × ${fmt(w, 2)}^0.425`, `${fmt(bsa, 3)} m²`));
    } else {
      const product = h * w;
      bsa = bsaMosteller(h, w);
      steps.push(step('Multiply height × weight', `${fmt(h)} × ${fmt(w, 2)}`, `${fmt(product, 1)}`));
      steps.push(step('Divide by 3600 and take the square root', `√(${fmt(product, 1)} / 3600)`, `${fmt(bsa, 3)} m²`));
    }

    const all = [
      { label: 'Mosteller', value: fmt(bsaMosteller(h, w), 3), unit: 'm²' },
      { label: 'Haycock', value: fmt(bsaHaycock(h, w), 3), unit: 'm²' },
      { label: 'Du Bois', value: fmt(bsaDuBois(h, w), 3), unit: 'm²' },
    ];

    return {
      value: bsa, unit: 'm²', label: 'Body surface area', decimals: 3,
      steps,
      extra: all,
      interpretation: interpret(LEVEL.INFO, `${fmt(bsa, 2)} m² by ${method === 'dubois' ? 'Du Bois' : method === 'haycock' ? 'Haycock' : 'Mosteller'}`),
    };
  },
  considerations: [
    'BSA drives insensible-loss estimates (400 mL/m²/day), peritoneal dialysis fill volumes, and steroid dosing (60 mg/m²/day) — an error here propagates widely.',
    'Mosteller and Haycock agree closely above ~10 kg; they diverge most in neonates and small infants, where Haycock is better validated.',
    'Du Bois was derived in adults and is the least appropriate of the three for children.',
    'Use actual measured length/height, not an estimate — BSA is not weight-only.',
  ],
  references: [
    'Mosteller RD. Simplified calculation of body-surface area. N Engl J Med 1987;317:1098.',
    'Haycock GB et al. Geometric method for measuring body surface area. J Pediatr 1978;93:62-6.',
  ],
};

export const midParentalHeight = {
  id: 'mid-parental-height',
  category: 'Growth & body size',
  title: 'Mid-Parental Target Height',
  source: 'Tanner JM. Arch Dis Child 1970',
  formula: 'Boys: (father + mother + 13 cm) / 2   ·   Girls: (father + mother − 13 cm) / 2',
  inputs: [
    { key: 'father', label: "Father's height", unit: 'cm', min: 120, max: 230, step: 0.5 },
    { key: 'mother', label: "Mother's height", unit: 'cm', min: 120, max: 230, step: 0.5 },
    {
      key: 'sex', label: 'Child’s sex', type: 'select', default: 'male',
      options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }],
    },
  ],
  compute(v) {
    const f = requireRange(v.father, 120, 230, "Father's height", 'father');
    const m = requireRange(v.mother, 120, 230, "Mother's height", 'mother');
    const sex = v.sex || 'male';
    const adj = sex === 'male' ? 13 : -13;

    const sum = f + m + adj;
    const target = sum / 2;

    return {
      value: target, unit: 'cm', label: 'Target height',
      steps: [
        step(`Adjust for sex (${sex === 'male' ? '+13 cm for a boy' : '−13 cm for a girl'})`,
          `${fmt(f)} + ${fmt(m)} ${adj > 0 ? '+' : '−'} 13`, `${fmt(sum)} cm`),
        step('Divide by 2', `${fmt(sum)} / 2`, `${fmt(target)} cm`),
      ],
      extra: [
        { label: 'Target range (±8.5 cm)', value: `${fmt(target - 8.5)} – ${fmt(target + 8.5)}`, unit: 'cm' },
      ],
      interpretation: interpret(LEVEL.INFO,
        `Target ${fmt(target)} cm (range ${fmt(target - 8.5)}–${fmt(target + 8.5)} cm)`),
    };
  },
  considerations: [
    'The ±8.5 cm band is roughly the 3rd–97th percentile of expected adult height for these parents.',
    'A child tracking well below the target range warrants a growth work-up — in CKD, growth failure is both common and treatable.',
    'Self-reported parental heights are systematically over-reported; measure them where it matters.',
    'The equivalent form adds/subtracts 6.5 cm to the mid-parental average — algebraically identical to ±13 cm before halving.',
  ],
  references: ['Tanner JM et al. Standards for children\'s height at ages 2-9 years. Arch Dis Child 1970;45:755-62.'],
};

export const calculators = [bodySurfaceArea, midParentalHeight];
