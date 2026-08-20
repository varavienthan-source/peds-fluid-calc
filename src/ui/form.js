/** Generic form renderer driven by a calculator descriptor's `inputs` array. */
'use strict';

import { unitOptions, ANALYTES } from '../units.js';

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

/**
 * Render the inputs for a calculator into `container`.
 * `onChange` fires on every edit. Returns a read() function producing the value map.
 */
export function renderForm(calc, container, onChange) {
  container.innerHTML = '';
  const fields = new Map();

  for (const input of calc.inputs) {
    const group = el('div', 'input-group');
    const id = `${calc.id}--${input.key}`;

    const label = el('label', null, input.label + (input.optional ? ' (optional)' : ''));
    label.setAttribute('for', id);
    group.appendChild(label);

    const row = el('div', 'input-row');

    if (input.type === 'checkbox') {
      const wrap = el('label', 'checkbox-wrap');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.id = id;
      box.checked = !!input.default;
      box.addEventListener('change', onChange);
      wrap.appendChild(box);
      wrap.appendChild(el('span', null, input.hint || 'Yes'));
      row.appendChild(wrap);
      fields.set(input.key, () => box.checked);
    } else if (input.type === 'select') {
      const sel = el('select', 'input-field');
      sel.id = id;
      for (const opt of input.options) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (String(opt.value) === String(input.default)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', onChange);
      row.appendChild(sel);
      fields.set(input.key, () => sel.value);
    } else {
      const box = document.createElement('input');
      box.type = 'number';
      box.className = 'input-field';
      box.id = id;
      box.inputMode = 'decimal';
      box.autocomplete = 'off';
      if (input.min !== undefined) box.min = input.min;
      if (input.max !== undefined) box.max = input.max;
      if (input.step !== undefined) box.step = input.step;
      if (input.default !== undefined) box.value = input.default;
      box.placeholder = input.unit ? input.unit : '';
      box.addEventListener('input', onChange);
      row.appendChild(box);
      fields.set(input.key, () => (box.value === '' ? undefined : Number(box.value)));

      // Unit selector for analytes that have an SI/conventional pair.
      const opts = input.analyte ? unitOptions(input.analyte) : [];
      if (opts.length > 1) {
        const sel = el('select', 'input-field unit-select');
        sel.setAttribute('aria-label', `Units for ${input.label}`);
        for (const u of opts) {
          const o = document.createElement('option');
          o.value = u;
          o.textContent = u;
          sel.appendChild(o);
        }
        sel.addEventListener('change', onChange);
        row.appendChild(sel);
        fields.set(`${input.key}Unit`, () => sel.value);
      } else if (input.unit) {
        const unit = el('span', 'unit-static', input.unit);
        row.appendChild(unit);
      }
    }

    group.appendChild(row);
    if (input.help) group.appendChild(el('div', 'input-help', input.help));
    container.appendChild(group);
  }

  return function read() {
    const out = {};
    for (const [key, getter] of fields) out[key] = getter();
    return out;
  };
}
