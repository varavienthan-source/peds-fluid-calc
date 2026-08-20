/**
 * SI <-> conventional unit conversion.
 *
 * Canadian labs (incl. Hamilton Health Sciences / McMaster) report in SI.
 * The CAPN Paediatric Nephrology Resident Handbook (2021) is SI-native, but
 * much of the published literature is in US conventional units. Every
 * calculator normalises to SI on entry and records the conversion as a
 * visible step, so the arithmetic is always auditable.
 *
 * Convention for `factor`:  SI value = conventional value x factor
 */
'use strict';

export const ANALYTES = {
  creatinine:  { label: 'Creatinine',            si: 'µmol/L',   conv: 'mg/dL',       factor: 88.4 },
  urea:        { label: 'Urea (BUN)',            si: 'mmol/L',   conv: 'mg/dL',       factor: 1 / 2.8 },
  glucose:     { label: 'Glucose',               si: 'mmol/L',   conv: 'mg/dL',       factor: 1 / 18 },
  calcium:     { label: 'Calcium',               si: 'mmol/L',   conv: 'mg/dL',       factor: 1 / 4 },
  phosphate:   { label: 'Phosphate',             si: 'mmol/L',   conv: 'mg/dL',       factor: 1 / 3.1 },
  magnesium:   { label: 'Magnesium',             si: 'mmol/L',   conv: 'mg/dL',       factor: 1 / 2.43 },
  albumin:     { label: 'Albumin',               si: 'g/L',      conv: 'g/dL',        factor: 10 },
  hemoglobin:  { label: 'Hemoglobin',            si: 'g/L',      conv: 'g/dL',        factor: 10 },
  urate:       { label: 'Urate (uric acid)',     si: 'µmol/L',   conv: 'mg/dL',       factor: 59.5 },
  cystatinC:   { label: 'Cystatin C',            si: 'mg/L',     conv: 'mg/L',        factor: 1 },
  proteinCr:   { label: 'Urine protein/creat',   si: 'mg/mmol',  conv: 'mg/g',        factor: 1 / 8.84 },
  albuminCr:   { label: 'Urine albumin/creat',   si: 'mg/mmol',  conv: 'mg/g',        factor: 1 / 8.84 },
  calciumCr:   { label: 'Urine calcium/creat',   si: 'mmol/mmol',conv: 'mg/mg',       factor: 2.82 },
};

/** Electrolytes where SI and conventional are numerically identical (mmol/L == mEq/L for monovalent ions). */
export const IDENTICAL = ['sodium', 'potassium', 'chloride', 'bicarbonate'];

/** Convert a conventional-unit value to SI. */
export function toSI(analyte, value) {
  const a = ANALYTES[analyte];
  if (!a) throw new Error(`Unknown analyte: ${analyte}`);
  return value * a.factor;
}

/** Convert an SI value to conventional units. */
export function toConventional(analyte, value) {
  const a = ANALYTES[analyte];
  if (!a) throw new Error(`Unknown analyte: ${analyte}`);
  return value / a.factor;
}

/**
 * Normalise a {value, unit} pair to SI.
 * `unit` may be either the SI or the conventional unit string for the analyte.
 * Returns { value, unit, converted, from } so callers can emit a visible step.
 */
export function normalise(analyte, value, unit) {
  const a = ANALYTES[analyte];
  if (!a) throw new Error(`Unknown analyte: ${analyte}`);
  if (unit === undefined || unit === a.si) {
    return { value, unit: a.si, converted: false };
  }
  if (unit === a.conv) {
    return { value: toSI(analyte, value), unit: a.si, converted: true, from: { value, unit } };
  }
  throw new Error(`Unit "${unit}" is not valid for ${analyte} (expected ${a.si} or ${a.conv})`);
}

/** Unit options for a select control. */
export function unitOptions(analyte) {
  const a = ANALYTES[analyte];
  if (!a) return [];
  return a.si === a.conv ? [a.si] : [a.si, a.conv];
}
