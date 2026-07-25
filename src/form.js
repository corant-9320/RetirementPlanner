/**
 * Form interaction layer: money formatting, currency toggles, reading params from DOM.
 */

import { parseMoney, formatMoney, currentFractYear } from './utils.js';

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
    const raw = parseMoney(input.value);
    input.value = raw === 0 && input.value.trim() === '' ? '' : String(raw);
  });
  input.addEventListener('blur', () => {
    const raw = parseMoney(input.value);
    if (input.value.trim() !== '') input.value = formatMoney(raw);
  });
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^\d\-]/g, '');
  });
}

// ── Initialise all currency toggles on the page ─
export function initCurrencyToggles() {
  document.querySelectorAll('.cur-toggle').forEach(toggle => {
    const id = toggle.dataset.id;
    const active = toggle.querySelector('button.active');
    fieldCurrency[id] = active ? active.dataset.cur : 'GBP';
    toggle.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fieldCurrency[id] = btn.dataset.cur;
      });
    });
  });
}

// ── DOM readers ─────────────────────────────────
function eurGbpRate() {
  return parseFloat(document.getElementById('eurGbp').value) || 1;
}

function readMoney(id) {
  const raw = parseMoney(document.getElementById(id).value);
  return fieldCurrency[id] === 'EUR' ? raw * eurGbpRate() : raw;
}

function readPlain(id) {
  return parseFloat(document.getElementById(id).value) || 0;
}

function readYQ(yearId, qId) {
  return readPlain(yearId) + parseFloat(document.getElementById(qId).value);
}

// ── Read all parameters from the form ───────────
const MONEY_FIELDS = [
  'salary', 'savings', 'pension', 'spUser', 'spUser2', 'spSpouse',
  'mortgageRem', 'mortgagePay', 'mortgageCapital', 'houseValue',
  'rentMonthly', 'housePurchasePrice', 'targetSpend',
];
const PLAIN_FIELDS = [
  'eurGbp', 'monthsWork', 'savingsRate', 'borrowRate', 'pensionRate', 'drawdown',
  'spIncrease', 'houseGrowth', 'spUserYear', 'spUser2Year', 'spSpouseYear',
  'houseSaleYear', 'housePurchaseYear', 'drawdownYear',
  'taxPayers', 'taxAllowance', 'taxBasicLimit', 'taxHigherLimit',
  'taxBasicRate', 'taxHigherRate', 'taxAddRate', 'pensionTaxFree',
  'taxSavingsStartBand',
];
const SELECT_FIELDS = [
  'spUserQ', 'spUser2Q', 'spSpouseQ', 'houseSaleQ', 'housePurchaseQ', 'drawdownQ',
];

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
 */
export function snapshotForm(events) {
  return {
    fieldCurrency: Object.assign({}, fieldCurrency),
    rawValues: fieldValues(MONEY_FIELDS),
    plainValues: fieldValues(PLAIN_FIELDS),
    selectValues: fieldValues(SELECT_FIELDS),
    events: events.map(e => Object.assign({}, e)),
  };
}

/**
 * Read all form parameters into a plain object suitable for simulate().
 * @param {Array} events - Current one-off events array
 */
export function readParams(events) {
  return {
    eurGbp: eurGbpRate(),
    salary: readMoney('salary'),
    monthsWork: readPlain('monthsWork'),
    savings: readMoney('savings'),
    savingsRate: readPlain('savingsRate') / 100,
    borrowRate: readPlain('borrowRate') / 100,
    pension: readMoney('pension'),
    pensionRate: readPlain('pensionRate') / 100,
    drawdown: readPlain('drawdown') / 100,
    drawdownStartFY: readYQ('drawdownYear', 'drawdownQ'),
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
    taxPayers: Math.max(1, readPlain('taxPayers') || 1),
    pensionTaxFree: Math.min(1, Math.max(0, readPlain('pensionTaxFree') / 100)),
    taxBands: {
      personalAllowance: readPlain('taxAllowance'),
      basicLimit: readPlain('taxBasicLimit'),
      higherLimit: readPlain('taxHigherLimit'),
      basicRate: readPlain('taxBasicRate') / 100,
      higherRate: readPlain('taxHigherRate') / 100,
      additionalRate: readPlain('taxAddRate') / 100,
      savingsStartBand: readPlain('taxSavingsStartBand'),
    },
    events: events.slice(),
    // Snapshot for save/restore
    _fieldCurrency: Object.assign({}, fieldCurrency),
    _rawValues: fieldValues(MONEY_FIELDS),
    _plainValues: fieldValues(PLAIN_FIELDS),
    _selectValues: fieldValues(SELECT_FIELDS),
  };
}

/**
 * Restore form state from a saved scenario object.
 * @param {object} saved - The scenario data from storage
 * @param {Function} onEventsRestored - Callback receiving restored events array
 */
export function restoreForm(saved, onEventsRestored) {
  // Plain inputs
  Object.entries(saved.plainValues).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  // Selects (quarter dropdowns)
  Object.entries(saved.selectValues).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      for (const o of el.options) {
        if (o.value === val) { o.selected = true; break; }
      }
    }
  });

  // Money values + currency toggles
  Object.entries(saved.rawValues).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  Object.entries(saved.fieldCurrency).forEach(([id, cur]) => {
    fieldCurrency[id] = cur;
    const toggle = document.querySelector(`.cur-toggle[data-id="${id}"]`);
    if (toggle) {
      toggle.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.cur === cur);
      });
    }
  });

  // Events
  const events = (saved.events || []).map(e =>
    Object.assign({ fractYear: currentFractYear(), amount: 0, description: '', currency: 'GBP' }, e)
  );
  onEventsRestored(events);
}
