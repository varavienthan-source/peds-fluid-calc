/** The plain-arithmetic calculator tab, plus an SI <-> conventional unit converter. */
'use strict';

import { evaluate } from '../expression.js';
import { ANALYTES, toSI, toConventional } from '../units.js';
import { fmt } from '../fmt.js';

const KEYS = [
  ['C', 'clear'], ['(', 'char'], [')', 'char'], ['÷', 'char'],
  ['7', 'char'], ['8', 'char'], ['9', 'char'], ['×', 'char'],
  ['4', 'char'], ['5', 'char'], ['6', 'char'], ['−', 'char'],
  ['1', 'char'], ['2', 'char'], ['3', 'char'], ['+', 'char'],
  ['0', 'char'], ['.', 'char'], ['⌫', 'back'], ['=', 'equals'],
];

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function renderCalculator(container) {
  container.innerHTML = '';

  // ---------- arithmetic ----------
  const card = el('div', 'input-card');
  card.appendChild(el('div', 'card-label', 'Calculator'));

  const display = document.createElement('input');
  display.className = 'calc-display';
  display.type = 'text';
  display.inputMode = 'text';
  display.setAttribute('aria-label', 'Calculator expression');
  display.placeholder = '0';
  card.appendChild(display);

  const preview = el('div', 'calc-preview', '');
  card.appendChild(preview);

  const tape = el('div', 'calc-tape');
  const history = [];

  function updatePreview() {
    const raw = display.value.trim();
    if (!raw) { preview.textContent = ''; preview.classList.remove('calc-error'); return; }
    try {
      const value = evaluate(raw);
      preview.textContent = `= ${fmt(value, 6)}`;
      preview.classList.remove('calc-error');
    } catch (err) {
      preview.textContent = err.message;
      preview.classList.add('calc-error');
    }
  }

  function commit() {
    const raw = display.value.trim();
    if (!raw) return;
    try {
      const value = evaluate(raw);
      history.unshift({ expr: raw, value });
      display.value = String(value);
      renderTape();
      updatePreview();
    } catch {
      preview.classList.add('calc-error');
    }
  }

  function renderTape() {
    tape.innerHTML = '';
    if (!history.length) return;
    tape.appendChild(el('div', 'card-label', 'History'));
    history.slice(0, 12).forEach((h) => {
      const row = el('div', 'tape-row');
      row.appendChild(el('span', 'tape-expr', h.expr));
      row.appendChild(el('span', 'tape-value', `= ${fmt(h.value, 6)}`));
      row.addEventListener('click', () => { display.value = String(h.value); updatePreview(); display.focus(); });
      tape.appendChild(row);
    });
  }

  const pad = el('div', 'calc-pad');
  for (const [label, action] of KEYS) {
    const btn = el('button', 'calc-key', label);
    btn.type = 'button';
    if (label === '=') btn.classList.add('calc-key-equals');
    if (label === 'C' || label === '⌫') btn.classList.add('calc-key-fn');
    if ('÷×−+'.includes(label)) btn.classList.add('calc-key-op');
    btn.addEventListener('click', () => {
      if (action === 'clear') { display.value = ''; }
      else if (action === 'back') { display.value = display.value.slice(0, -1); }
      else if (action === 'equals') { commit(); return; }
      else { display.value += label; }
      updatePreview();
      display.focus();
    });
    pad.appendChild(btn);
  }
  card.appendChild(pad);

  display.addEventListener('input', updatePreview);
  display.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
  });

  container.appendChild(card);
  container.appendChild(tape);

  // ---------- unit converter ----------
  const conv = el('div', 'input-card');
  conv.appendChild(el('div', 'card-label', 'Unit converter — SI ↔ conventional'));

  const pick = el('select', 'input-field');
  for (const [key, a] of Object.entries(ANALYTES)) {
    if (a.si === a.conv) continue;
    const o = document.createElement('option');
    o.value = key;
    o.textContent = a.label;
    pick.appendChild(o);
  }
  const pickGroup = el('div', 'input-group');
  pickGroup.appendChild(el('label', null, 'Analyte'));
  pickGroup.appendChild(pick);
  conv.appendChild(pickGroup);

  const siGroup = el('div', 'input-group');
  const siLabel = el('label', null, 'SI');
  const siInput = document.createElement('input');
  siInput.type = 'number';
  siInput.className = 'input-field';
  siInput.inputMode = 'decimal';
  siGroup.appendChild(siLabel);
  siGroup.appendChild(siInput);
  conv.appendChild(siGroup);

  const cvGroup = el('div', 'input-group');
  const cvLabel = el('label', null, 'Conventional');
  const cvInput = document.createElement('input');
  cvInput.type = 'number';
  cvInput.className = 'input-field';
  cvInput.inputMode = 'decimal';
  cvGroup.appendChild(cvLabel);
  cvGroup.appendChild(cvInput);
  conv.appendChild(cvGroup);

  const factorNote = el('div', 'input-help', '');
  conv.appendChild(factorNote);

  function refreshLabels() {
    const a = ANALYTES[pick.value];
    siLabel.textContent = `SI — ${a.si}`;
    cvLabel.textContent = `Conventional — ${a.conv}`;
    siInput.placeholder = a.si;
    cvInput.placeholder = a.conv;
    factorNote.textContent = `1 ${a.conv} = ${fmt(a.factor, 4)} ${a.si}`;
  }

  siInput.addEventListener('input', () => {
    if (siInput.value === '') { cvInput.value = ''; return; }
    cvInput.value = Number(toConventional(pick.value, Number(siInput.value)).toFixed(4));
  });
  cvInput.addEventListener('input', () => {
    if (cvInput.value === '') { siInput.value = ''; return; }
    siInput.value = Number(toSI(pick.value, Number(cvInput.value)).toFixed(4));
  });
  pick.addEventListener('change', () => {
    refreshLabels();
    siInput.value = '';
    cvInput.value = '';
  });

  refreshLabels();
  container.appendChild(conv);
}
