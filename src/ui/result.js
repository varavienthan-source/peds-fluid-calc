/** Renders a computed result plus the collapsible "show your work" panel. */
'use strict';

import { fmt } from '../fmt.js';

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function section(title) {
  const s = el('div', 'work-section');
  s.appendChild(el('h4', 'work-heading', title));
  return s;
}

/** Render an InputError or a thrown exception as a blocking message. */
export function renderError(err, container) {
  container.innerHTML = '';
  const box = el('div', 'result-error');
  box.appendChild(el('span', 'result-error-icon', err.name === 'InputError' ? 'ℹ️' : '🚨'));
  box.appendChild(el('span', null, err.message));
  container.appendChild(box);
}

/** Render a full result card. */
export function renderResult(calc, result, container) {
  container.innerHTML = '';

  // Headline value
  const head = el('div', 'result-head');
  const dp = result.decimals !== undefined ? result.decimals : 1;
  head.appendChild(el('div', 'result-label', result.label || calc.title));
  const valueRow = el('div', 'result-value-row');
  valueRow.appendChild(el('span', 'result-value', fmt(result.value, dp)));
  if (result.unit) valueRow.appendChild(el('span', 'result-unit', result.unit));
  head.appendChild(valueRow);
  container.appendChild(head);

  // Interpretation
  if (result.interpretation) {
    const i = result.interpretation;
    const box = el('div', `interp interp-${i.level}`);
    box.appendChild(el('div', 'interp-text', i.text));
    if (i.detail) box.appendChild(el('div', 'interp-detail', i.detail));
    container.appendChild(box);
  }

  // Warnings
  if (result.warnings && result.warnings.length) {
    const list = el('div', 'warn-list');
    for (const w of result.warnings) {
      const item = el('div', `warn warn-${w.level}`);
      item.appendChild(el('span', 'warn-icon',
        w.level === 'danger' ? '🚨' : w.level === 'warn' ? '⚠️' : 'ℹ️'));
      item.appendChild(el('span', null, w.text));
      list.appendChild(item);
    }
    container.appendChild(list);
  }

  // Secondary values
  if (result.extra && result.extra.length) {
    const grid = el('div', 'extra-grid');
    for (const x of result.extra) {
      const cell = el('div', 'extra-item');
      cell.appendChild(el('div', 'extra-label', x.label));
      const v = el('div', 'extra-value');
      v.appendChild(el('span', null, x.value));
      if (x.unit) v.appendChild(el('span', 'extra-unit', ' ' + x.unit));
      cell.appendChild(v);
      grid.appendChild(cell);
    }
    container.appendChild(grid);
  }

  // ---- Show your work ----
  const details = document.createElement('details');
  details.className = 'work';
  details.open = false;
  const summary = document.createElement('summary');
  summary.className = 'work-summary';
  summary.textContent = 'Show the work — formula, steps, and considerations';
  details.appendChild(summary);

  if (calc.formula) {
    const s = section('Formula');
    s.appendChild(el('code', 'formula', calc.formula));
    details.appendChild(s);
  }

  if (result.steps && result.steps.length) {
    const s = section('Step by step');
    const ol = el('ol', 'steps');
    for (const st of result.steps) {
      const li = el('li', 'step');
      li.appendChild(el('div', 'step-label', st.label));
      const calcRow = el('div', 'step-calc');
      calcRow.appendChild(el('code', 'step-expr', st.expr));
      calcRow.appendChild(el('span', 'step-arrow', '='));
      calcRow.appendChild(el('strong', 'step-result', st.result));
      li.appendChild(calcRow);
      ol.appendChild(li);
    }
    s.appendChild(ol);
    details.appendChild(s);
  }

  if (calc.considerations && calc.considerations.length) {
    const s = section('Considerations');
    const ul = el('ul', 'considerations');
    for (const c of calc.considerations) ul.appendChild(el('li', null, c));
    s.appendChild(ul);
    details.appendChild(s);
  }

  if (calc.source || (calc.references && calc.references.length)) {
    const s = section('Source');
    if (calc.source) s.appendChild(el('div', 'source', calc.source));
    if (calc.references) {
      const ul = el('ul', 'references');
      for (const r of calc.references) ul.appendChild(el('li', null, r));
      s.appendChild(ul);
    }
    details.appendChild(s);
  }

  container.appendChild(details);
}

/** Plain-text summary for the clipboard, including the shown work. */
export function resultToText(calc, result) {
  const dp = result.decimals !== undefined ? result.decimals : 1;
  const lines = [];
  lines.push(calc.title);
  lines.push('='.repeat(calc.title.length));
  lines.push(`${result.label || 'Result'}: ${fmt(result.value, dp)} ${result.unit || ''}`.trim());
  if (result.interpretation) {
    lines.push(`Interpretation: ${result.interpretation.text}`);
    if (result.interpretation.detail) lines.push(`  ${result.interpretation.detail}`);
  }
  if (result.extra && result.extra.length) {
    lines.push('');
    for (const x of result.extra) lines.push(`  ${x.label}: ${x.value} ${x.unit || ''}`.trimEnd());
  }
  if (calc.formula) {
    lines.push('');
    lines.push(`Formula: ${calc.formula}`);
  }
  if (result.steps && result.steps.length) {
    lines.push('');
    lines.push('Working:');
    result.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s.label}: ${s.expr} = ${s.result}`));
  }
  if (result.warnings && result.warnings.length) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of result.warnings) lines.push(`  - ${w.text}`);
  }
  if (calc.source) {
    lines.push('');
    lines.push(`Source: ${calc.source}`);
  }
  lines.push('');
  lines.push('Clinical decision support only — verify against local protocol.');
  return lines.join('\n');
}
