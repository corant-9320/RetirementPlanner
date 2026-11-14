/**
 * Form interaction layer: money formatting, currency toggles, reading params from DOM.
 */

import { formatMoney, currentFractYear } from './utils.js';

// ── Currency state ──────────────────────────────
const fieldCurrency = {};

/** Get the current field→currency map (for save/restore). */
export function getFieldCurrency() {
  return Object.assign({}, fieldCurrency);
}

/** Set a field's currency (for restore). */
export function setFieldCurrency(id, cur) {
  fieldCurrency[id] = cur;
}

// ── Money input formatting ──────────────────────
export function attachMoneyFormatting(input) {
  input.addEventListener('focus', () => {
    const raw = strictMoney(input.value);
    if (Number.isFinite(raw)) input.value = String(raw);
  });
  input.addEventListener('blur', () => {
    if (input.value.trim() === '') return;
    const raw = strictMoney(input.value);
    if (Number.isFinite(raw)) input.value = formatMoney(raw);
  });
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^\d\-]/g, '');
  });
}

function toggleLabel(toggle, currency) {
  const input = document.getElementById(toggle.dataset.id);
  const fieldLabel = input?.closest('.field')?.querySelector('label')?.textContent.trim() || toggle.dataset.id || 'amount';
  return `Use ${currency} for ${fieldLabel}`;
}

function updateToggleState(toggle, selectedCurrency) {
  toggle.querySelectorAll('button').forEach(btn => {
    const selected = btn.dataset.cur === selectedCurrency;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-pressed', String(selected));
  });
}

// ── Initialise labels and currency toggles ──────
export function initFormAccessibility() {
  let generatedId = 0;
  document.querySelectorAll('.field > label').forEach(label => {
    const field = label.parentElement;
    const control = field.querySelector('input, select, textarea');
    if (!control) return;
    if (!control.id) control.id = `form-control-${++generatedId}`;
    label.htmlFor = control.id;

    const quarter = field.querySelector('.yq-wrap select');
    if (quarter && !quarter.getAttribute('aria-label')) {
      quarter.setAttribute('aria-label', `${label.textContent.trim()}, quarter`);
    }
  });
}

export function initCurrencyToggles() {
  document.querySelectorAll('.cur-toggle').forEach(toggle => {
    const id = toggle.dataset.id;
    const active = toggle.querySelector('button.active');
    fieldCurrency[id] = active ? active.dataset.cur : 'GBP';
    toggle.setAttribute('role', 'group');
    toggle.querySelectorAll('button').forEach(btn => {
      btn.type = 'button';
      btn.setAttribute('aria-label', toggleLabel(toggle, btn.dataset.cur));
      btn.addEventListener('click', () => {
        fieldCurrency[id] = btn.dataset.cur;
        updateToggleState(toggle, btn.dataset.cur);
      });
    });
    updateToggleState(toggle, fieldCurrency[id]);
  });
}

// ── DOM readers ─────────────────────────────────
function strictNumber(value) {
  const text = String(value).trim();
  if (!text) return NaN;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

function strictMoney(value) {
  return strictNumber(String(value).replace(/,/g, ''));
}

function eurGbpRate() {
  return strictNumber(document.getElementById('eurGbp')?.value);
}

function readMoney(id) {
  const raw = strictMoney(document.getElementById(id)?.value ?? '');
  return fieldCurrency[id] === 'EUR' ? raw * eurGbpRate() : raw;
}

function readPlain(id) {
  return strictNumber(document.getElementById(id)?.value ?? '');
}

function readYQ(yearId, qId) {
  return readPlain(yearId) + strictNumber(document.getElementById(qId)?.value ?? '');
}

// ── Declarative form field registry ─────────────
// Add every persisted form control here so snapshots and restore stay aligned.
export const FIELD_SCHEMA = Object.freeze([
  ...[
    'salary', 'savings', 'pension', 'spUser', 'spUser2', 'spSpouse',
    'mortgageRem', 'mortgagePay', 'mortgageCapital', 'houseValue',
    'rentMonthly', 'housePurchasePrice', 'targetSpend',
  ].map(id => ({ id, kind: 'money' })),
  ...[
    'eurGbp', 'monthsWork', 'savingsRate', 'borrowRate', 'pensionRate',
    'spIncrease', 'houseGrowth', 'spUserYear', 'spUser2Year', 'spSpouseYear',
    'houseSaleYear', 'housePurchaseYear',
    'taxPayers', 'taxAllowance', 'taxBasicLimit', 'taxHigherLimit',
    'taxBasicRate', 'taxHigherRate', 'taxAddRate', 'pensionTaxFree',
    'taxSavingsStartBand',
  ].map(id => ({ id, kind: 'plain' })),
  ...[
    'spUserQ', 'spUser2Q', 'spSpouseQ', 'houseSaleQ', 'housePurchaseQ',
  ].map(id => ({ id, kind: 'select' })),
]);

/** Detached copy of raw drawdown-line UI values. */
export function cloneDrawdownLines(lines) {
  return (lines || []).map(line => ({
    year: String(line.year ?? ''),
    quarter: String(line.quarter ?? '0'),
    rate: String(line.rate ?? ''),
  }));
}

/** Convert raw drawdown-line UI values to domain lines ({startFY, rate}). */
export function drawdownParams(lines) {
  return cloneDrawdownLines(lines).map(line => ({
    startFY: strictNumber(line.year) + strictNumber(line.quarter),
    rate: strictNumber(line.rate) / 100,
  }));
}

const fieldsOfKind = kind => FIELD_SCHEMA.filter(field => field.kind === kind).map(field => field.id);
const MONEY_FIELDS = fieldsOfKind('money');
const PLAIN_FIELDS = fieldsOfKind('plain');
const SELECT_FIELDS = fieldsOfKind('select');

function fieldValues(ids) {
  return Object.fromEntries(
    ids.map(id => {
      const el = document.getElementById(id);
      return [id, el ? el.value : ''];
    })
  );
}

/**
 * Capture the full form state as a plain, JSON-serialisable snapshot.
 * Uses the same shape as saved scenarios, so restoreForm() can apply it directly.
 * @param {Array} events - Current one-off events array
 * @param {Array} drawdowns - Current raw drawdown lines ({year, quarter, rate} strings)
 */
export function snapshotForm(events, drawdowns) {
  return {
    fieldCurrency: Object.assign({}, fieldCurrency),
    rawValues: fieldValues(MONEY_FIELDS),
    plainValues: fieldValues(PLAIN_FIELDS),
    selectValues: fieldValues(SELECT_FIELDS),
    events: events.map(e => Object.assign({}, e)),
    drawdowns: cloneDrawdownLines(drawdowns),
  };
}

/**
 * Read all form parameters into a plain object suitable for simulate().
 * @param {Array} events - Current one-off events array
 * @param {Array} drawdowns - Current raw drawdown lines
 */
export function readParams(events, drawdowns) {
  return {
    eurGbp: eurGbpRate(),
    salary: readMoney('salary'),
    monthsWork: readPlain('monthsWork'),
    savings: readMoney('savings'),
    savingsRate: readPlain('savingsRate') / 100,
    borrowRate: readPlain('borrowRate') / 100,
    pension: readMoney('pension'),
    pensionRate: readPlain('pensionRate') / 100,
    drawdowns: drawdownParams(drawdowns),
    spUser: readMoney('spUser'),
    spUserFY: readYQ('spUserYear', 'spUserQ'),
    spUser2: readMoney('spUser2'),
    spUser2FY: readYQ('spUser2Year', 'spUser2Q'),
    spSpouse: readMoney('spSpouse'),
    spSpouseFY: readYQ('spSpouseYear', 'spSpouseQ'),
    spIncrease: readPlain('spIncrease') / 100,
    houseValue: readMoney('houseValue'),
    houseGrowth: readPlain('houseGrowth') / 100,
    mortgageRem: readMoney('mortgageRem'),
    mortgagePay: readMoney('mortgagePay'),
    mortgageCapital: readMoney('mortgageCapital'),
    houseSaleFY: readYQ('houseSaleYear', 'houseSaleQ'),
    rentMonthly: readMoney('rentMonthly'),
    housePurchaseFY: readYQ('housePurchaseYear', 'housePurchaseQ'),
    housePurchasePrice: readMoney('housePurchasePrice'),
    targetSpend: readMoney('targetSpend'),
    taxPayers: readPlain('taxPayers'),
    pensionTaxFree: readPlain('pensionTaxFree') / 100,
    taxBands: {
      personalAllowance: readPlain('taxAllowance'),
      basicLimit: readPlain('taxBasicLimit'),
      higherLimit: readPlain('taxHigherLimit'),
      basicRate: readPlain('taxBasicRate') / 100,
      higherRate: readPlain('taxHigherRate') / 100,
      additionalRate: readPlain('taxAddRate') / 100,
      savingsStartBand: readPlain('taxSavingsStartBand'),
    },
    events: events.map(event => Object.assign({}, event)),
  };
}

/**
 * Restore form state from a saved scenario object.
 * @param {object} saved - The scenario data from storage
 * @param {Function} onEventsRestored - Callback receiving (events, drawdowns) arrays
 */
export function restoreForm(saved, onEventsRestored) {
  const snapshot = saved || {};

  // Plain inputs
  Object.entries(snapshot.plainValues || {}).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  // Selects (quarter dropdowns)
  Object.entries(snapshot.selectValues || {}).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      for (const o of el.options) {
        if (o.value === val) { o.selected = true; break; }
      }
    }
  });

  // Money values + currency toggles
  Object.entries(snapshot.rawValues || {}).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  Object.entries(snapshot.fieldCurrency || {}).forEach(([id, cur]) => {
    fieldCurrency[id] = cur;
    const toggle = document.querySelector(`.cur-toggle[data-id="${id}"]`);
    if (toggle) updateToggleState(toggle, cur);
  });

  // Events
  const events = (snapshot.events || []).map(e =>
    Object.assign({ fractYear: currentFractYear(), amount: 0, description: '', currency: 'GBP' }, e)
  );
  onEventsRestored(events, cloneDrawdownLines(snapshot.drawdowns));
}
