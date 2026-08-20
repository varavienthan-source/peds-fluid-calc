/** Application shell: navigation, search, calculator selection, clipboard export. */
'use strict';

import { ALL, CATEGORIES, byCategory, byId, search } from './registry.js';
import { renderForm } from './ui/form.js';
import { renderResult, renderError, resultToText } from './ui/result.js';
import { renderCalculator } from './ui/calculator.js';

const state = {
  category: CATEGORIES[0],
  calcId: null,
  query: '',
  lastResult: null,
  lastCalc: null,
};

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

const dom = {};

function renderTabs() {
  dom.tabs.innerHTML = '';
  const entries = [...CATEGORIES, 'Calculator'];
  for (const cat of entries) {
    const btn = el('button', 'tab-btn', cat);
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    if (cat === state.category) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.category = cat;
      state.calcId = null;
      state.query = '';
      dom.search.value = '';
      render();
    });
    dom.tabs.appendChild(btn);
  }
}

function renderList() {
  dom.list.innerHTML = '';
  const items = state.query ? search(state.query) : byCategory(state.category);

  if (!items.length) {
    dom.list.appendChild(el('div', 'empty-state', 'No calculators match that search.'));
    return;
  }

  for (const calc of items) {
    const card = el('button', 'calc-card');
    card.type = 'button';
    card.appendChild(el('div', 'calc-card-title', calc.title));
    card.appendChild(el('div', 'calc-card-meta', calc.category));
    if (calc.formula) card.appendChild(el('code', 'calc-card-formula', calc.formula));
    card.addEventListener('click', () => {
      state.calcId = calc.id;
      render();
    });
    dom.list.appendChild(card);
  }
}

function renderDetail(calc) {
  dom.detail.innerHTML = '';

  const back = el('button', 'btn btn-reset', '← All calculators');
  back.type = 'button';
  back.addEventListener('click', () => { state.calcId = null; render(); });
  dom.detail.appendChild(back);

  const header = el('div', 'detail-header');
  header.appendChild(el('h2', 'detail-title', calc.title));
  header.appendChild(el('div', 'detail-source', calc.source || ''));
  dom.detail.appendChild(header);

  const inputCard = el('div', 'input-card');
  inputCard.appendChild(el('div', 'card-label', 'Inputs'));
  const formHost = el('div');
  inputCard.appendChild(formHost);
  dom.detail.appendChild(inputCard);

  const resultCard = el('div', 'results-card');
  dom.detail.appendChild(resultCard);

  const actions = el('div', 'action-buttons');
  const copyBtn = el('button', 'btn btn-copy', '📋 Copy with working');
  copyBtn.type = 'button';
  actions.appendChild(copyBtn);
  dom.detail.appendChild(actions);

  const read = renderForm(calc, formHost, recompute);

  function recompute() {
    const values = read();
    const required = calc.inputs.filter((i) => !i.optional && i.type !== 'checkbox');
    const missing = required.some((i) => values[i.key] === undefined || values[i.key] === '');
    if (missing) {
      resultCard.innerHTML = '';
      resultCard.appendChild(el('div', 'empty-state', 'Enter the values above to calculate.'));
      state.lastResult = null;
      return;
    }
    try {
      const result = calc.compute(values);
      renderResult(calc, result, resultCard);
      state.lastResult = result;
      state.lastCalc = calc;
    } catch (err) {
      renderError(err, resultCard);
      state.lastResult = null;
    }
  }

  copyBtn.addEventListener('click', async () => {
    if (!state.lastResult) return;
    const text = resultToText(calc, state.lastResult);
    const ok = await copyText(text);
    copyBtn.textContent = ok ? '✓ Copied' : '✗ Copy failed';
    setTimeout(() => { copyBtn.textContent = '📋 Copy with working'; }, 1800);
  });

  recompute();
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function render() {
  renderTabs();

  const showingCalculatorTab = state.category === 'Calculator' && !state.query;
  dom.searchWrap.style.display = showingCalculatorTab ? 'none' : '';

  if (showingCalculatorTab) {
    dom.list.style.display = 'none';
    dom.detail.style.display = '';
    renderCalculator(dom.detail);
    return;
  }

  const calc = state.calcId ? byId(state.calcId) : null;
  if (calc) {
    dom.list.style.display = 'none';
    dom.detail.style.display = '';
    renderDetail(calc);
  } else {
    dom.list.style.display = '';
    dom.detail.style.display = 'none';
    dom.detail.innerHTML = '';
    renderList();
  }
}

function initInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (!banner) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone || !isIOS || sessionStorage.getItem('installDismissed')) return;
  banner.classList.add('show');
  const btn = banner.querySelector('.install-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      banner.classList.remove('show');
      sessionStorage.setItem('installDismissed', '1');
    });
  }
}

export function init() {
  dom.tabs = document.getElementById('tabs');
  dom.search = document.getElementById('search');
  dom.searchWrap = document.getElementById('searchWrap');
  dom.list = document.getElementById('list');
  dom.detail = document.getElementById('detail');

  dom.search.addEventListener('input', () => {
    state.query = dom.search.value;
    state.calcId = null;
    render();
  });

  render();
  initInstallBanner();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is best-effort */ });
  }
}
