/** Central index of every calculator, grouped by category and searchable. */
'use strict';

import { calculators as fluids } from './calc/fluids.js';
import { calculators as electrolytes } from './calc/electrolytes.js';
import { calculators as acidbase } from './calc/acidbase.js';
import { calculators as aki } from './calc/aki.js';
import { calculators as egfr } from './calc/egfr.js';
import { calculators as proteinuria } from './calc/proteinuria.js';
import { calculators as bp } from './calc/bp.js';
import { calculators as growth } from './calc/growth.js';

export const ALL = [
  ...fluids, ...electrolytes, ...acidbase, ...aki,
  ...egfr, ...proteinuria, ...bp, ...growth,
];

/** Display order for category tabs. */
export const CATEGORIES = [
  'Fluids',
  'Electrolytes',
  'Acid–base',
  'Acute kidney injury',
  'Kidney function',
  'Proteinuria',
  'Blood pressure',
  'Growth & body size',
];

export function byCategory(category) {
  return ALL.filter((c) => c.category === category);
}

export function byId(id) {
  return ALL.find((c) => c.id === id);
}

/** Case-insensitive search over title, category, formula and considerations. */
export function search(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return ALL;
  return ALL.filter((c) => {
    const haystack = [
      c.title, c.category, c.formula, c.source,
      ...(c.considerations || []),
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
