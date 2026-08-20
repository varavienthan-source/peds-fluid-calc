/** Number/string formatting shared by every calculator. Ported from the original app. */
'use strict';

/** Round to `dp` decimals and strip a trailing ".0" — matches the original fmt(). */
export function fmt(n, dp = 1) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const r = Number(n).toFixed(dp);
  return r.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

/** Format with a unit suffix. */
export function fmtU(n, unit, dp = 1) {
  return `${fmt(n, dp)} ${unit}`;
}

/** Format a whole number with thousands separators. */
export function fmtInt(n) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-CA');
}

/** Render a duration in hours as "3.5 hr" or "45 min" when under 2 hours. */
export function fmtDuration(hours) {
  if (!isFinite(hours) || hours <= 0) return '—';
  return hours >= 2 ? `${fmt(hours)} hr` : `${Math.round(hours * 60)} min`;
}
