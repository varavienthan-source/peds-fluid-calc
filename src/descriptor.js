/**
 * Shared helpers for building calculator descriptors.
 *
 * A descriptor is a plain object:
 *   { id, category, title, source, formula, inputs[], compute(v), considerations[], references[] }
 *
 * `compute` returns:
 *   { value, unit, label, steps[], interpretation, extra[], warnings[] }
 *
 * The UI is generic over this shape, so adding a calculator never means writing UI,
 * and "show your work" comes for free from `steps` + `formula` + `considerations`.
 */
'use strict';

import { fmt } from './fmt.js';
import { normalise } from './units.js';

/** Build one line of shown work. */
export function step(label, expr, result) {
  return { label, expr, result };
}

/** Severity levels for interpretations and warnings. */
export const LEVEL = {
  NORMAL: 'normal',
  INFO: 'info',
  WARN: 'warn',
  DANGER: 'danger',
};

export function interpret(level, text, detail) {
  return { level, text, detail };
}

/** A blocking input error — the UI shows this instead of a result. */
export class InputError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'InputError';
    this.field = field;
  }
}

/** Assert a value is a finite number greater than zero. */
export function requirePositive(value, label, field) {
  if (value === null || value === undefined || value === '' || !isFinite(value)) {
    throw new InputError(`${label} is required.`, field);
  }
  if (value <= 0) {
    throw new InputError(`${label} must be greater than zero.`, field);
  }
  return Number(value);
}

/** Assert a value is a finite number (zero and negatives allowed). */
export function requireNumber(value, label, field) {
  if (value === null || value === undefined || value === '' || !isFinite(value)) {
    throw new InputError(`${label} is required.`, field);
  }
  return Number(value);
}

/** Assert a value falls inside [min, max]. */
export function requireRange(value, min, max, label, field) {
  const n = requireNumber(value, label, field);
  if (n < min || n > max) {
    throw new InputError(`${label} must be between ${fmt(min)} and ${fmt(max)}.`, field);
  }
  return n;
}

/**
 * Read an analyte input, normalise it to SI, and range-check the SI value.
 *
 * Range bounds are always expressed in SI. Validating the raw value would
 * reject legitimate conventional-unit entries (0.45 mg/dL creatinine is a
 * normal toddler value but falls outside any sane µmol/L range), so the
 * conversion must happen before the check, not after.
 */
export function requireAnalyte(analyte, value, unit, min, max, label, field) {
  const raw = requireNumber(value, label, field);
  const n = normalise(analyte, raw, unit);
  requireRange(n.value, min, max, `${label} (${n.unit})`, field);
  return n;
}

/**
 * Paediatric weight guardrails, ported from the original checkWeight().
 * Returns an array of warnings; throws InputError when the weight is unusable.
 */
export function weightWarnings(weightKg) {
  const w = requirePositive(weightKg, 'Weight', 'weight');
  if (w < 1) {
    throw new InputError('Weight under 1 kg — consult Neonatology for individualised fluid and drug dosing.', 'weight');
  }
  const out = [];
  if (w > 70) {
    out.push(interpret(LEVEL.WARN, 'Weight over 70 kg — use adult dosing. Maintenance is typically capped near 100–130 mL/hr.'));
  }
  return out;
}
