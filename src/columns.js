/**
 * Column definitions, ordering, and cell rendering for the results table.
 */

import { gbp, cell } from './utils.js';

// Column descriptors — 'year' is pinned first and not draggable.
export const ALL_COLUMNS = [
  { key: 'year', label: 'Year', draggable: false },
  { key: 'salaryIncome', label: 'Salary', draggable: true },
  { key: 'pensionDrawn', label: 'Pension Income', draggable: true },
  { key: 'statePension', label: 'State Pension', draggable: true },
  { key: 'savingsInterest', label: 'Savings Interest', draggable: true },
  { key: 'oneOff', label: 'One-offs / Sale', draggable: true },
  { key: 'totalIncome', label: 'Total Income', draggable: true },
  { key: 'mortgage', label: 'Mortgage', draggable: true },
  { key: 'rent', label: 'Rent', draggable: true },
  { key: 'housePurchase', label: 'House Purchase', draggable: true },
  { key: 'livingSpend', label: 'Living Spend', draggable: true },
  { key: 'taxableIncome', label: 'Taxable Income', draggable: true },
  { key: 'tax', label: 'Tax', draggable: true },
  { key: 'totalOutgoings', label: 'Total Outgoings', draggable: true },
  { key: 'pensionPot', label: 'Pension Pot (yr start)', draggable: true },
  { key: 'pensionGrowth', label: 'Pension Growth', draggable: true },
  { key: 'pensionWithdrawals', label: 'Pension Withdrawals', draggable: true },
  { key: 'savingsEnd', label: 'Savings (yr end)', draggable: true },
];

export const COL_ORDER_KEY = 'retirementPlanner_colOrder';

const DEFAULT_COL_ORDER = Object.freeze(ALL_COLUMNS.map(column => column.key));

// Columns added after column orders were first persisted. A saved order that is
// complete apart from these gets them inserted straight after the pension pot.
const ADDED_COLUMNS = Object.freeze(['pensionGrowth', 'pensionWithdrawals']);
const PREVIOUS_COL_ORDER = Object.freeze(DEFAULT_COL_ORDER.filter(key => !ADDED_COLUMNS.includes(key)));

function isExactOrder(order, keys) {
  if (!Array.isArray(order) || order.length !== keys.length || order[0] !== 'year') return false;
  const seen = new Set(order);
  return seen.size === order.length && keys.every(key => seen.has(key));
}

/** Upgrade a valid pre-pension-columns order, or return null. Pure. */
export function migrateColOrder(order) {
  if (!isExactOrder(order, PREVIOUS_COL_ORDER)) return null;
  const migrated = [...order];
  migrated.splice(migrated.indexOf('pensionPot') + 1, 0, ...ADDED_COLUMNS);
  return migrated;
}

/** Validate exact key membership, uniqueness, and the pinned year-first rule. */
export function isValidColOrder(order) {
  return isExactOrder(order, DEFAULT_COL_ORDER);
}

export const validateColOrder = isValidColOrder;

/**
 * Produce a valid detached order. Known unique keys retain their relative order;
 * year is pinned first and missing keys are appended in their default order.
 */
export function normalizeColOrder(order) {
  if (!Array.isArray(order)) return [...DEFAULT_COL_ORDER];
  const known = new Set(DEFAULT_COL_ORDER);
  const seen = new Set(['year']);
  const normalized = ['year'];
  for (const key of order) {
    if (key !== 'year' && known.has(key) && !seen.has(key)) {
      seen.add(key);
      normalized.push(key);
    }
  }
  for (const key of DEFAULT_COL_ORDER) {
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(key);
    }
  }
  return normalized;
}

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function loadColOrder(storage) {
  const target = getStorage(storage);
  if (!target || typeof target.getItem !== 'function') return [...DEFAULT_COL_ORDER];
  try {
    const saved = JSON.parse(target.getItem(COL_ORDER_KEY));
    if (isValidColOrder(saved)) return [...saved];
    return migrateColOrder(saved) || [...DEFAULT_COL_ORDER];
  } catch {
    return [...DEFAULT_COL_ORDER];
  }
}

export function saveColOrder(order, storage) {
  if (!isValidColOrder(order)) return { ok: false, error: 'invalid-order' };
  const target = getStorage(storage);
  if (!target || typeof target.setItem !== 'function') {
    return { ok: false, error: 'storage-unavailable' };
  }
  try {
    target.setItem(COL_ORDER_KEY, JSON.stringify(order));
    return { ok: true };
  } catch {
    return { ok: false, error: 'write-failed' };
  }
}

/** Get a complete, valid ordered set of column descriptors. */
export function orderedCols(colOrder) {
  const byKey = new Map(ALL_COLUMNS.map(column => [column.key, column]));
  return normalizeColOrder(colOrder).map(key => byKey.get(key));
}

/** Build tooltip for one-off events cell. */
function oneOffTooltip(eventsInYear, houseSaleAmt, p) {
  const lines = [];
  eventsInYear.forEach(e => {
    const amt = e.currency === 'EUR' ? e.amount * p.eurGbp : e.amount;
    const label = (e.description || '(no description)').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
    lines.push(`${label}: ${gbp(amt)}`);
  });
  if (houseSaleAmt) lines.push(`House sale (equity \u2192 cash): ${gbp(houseSaleAmt)}`);
  return lines.join('\n');
}

/** Build tooltip showing the tax band breakdown for a row. */
function taxTooltip(r, p) {
  const b = p.taxBands || {};
  const pct = v => Math.round((v || 0) * 100);
  const lines = [];
  lines.push(`Pension income (taxable): ${gbp(r.taxPensionIncome)}`);
  if (r.taxSavingsInterest > 0) {
    lines.push(`Savings interest: ${gbp(r.taxSavingsInterest)}`);
    if (r.taxPsaUsed > 0) lines.push(`Savings allowances (0% band + PSA): \u2212${gbp(r.taxPsaUsed)}`);
  }
  lines.push(`Taxable income: ${gbp(r.taxableIncome)}`);
  lines.push('\u2500\u2500\u2500');
  if (r.taxBasic > 0) lines.push(`Basic (${pct(b.basicRate)}%): ${gbp(r.taxBasic)}`);
  if (r.taxHigher > 0) lines.push(`Higher (${pct(b.higherRate)}%): ${gbp(r.taxHigher)}`);
  if (r.taxAdditional > 0) lines.push(`Additional (${pct(b.additionalRate)}%): ${gbp(r.taxAdditional)}`);
  lines.push(`Total tax: ${gbp(r.tax)}`);
  if (p.taxPayers > 1 && r.taxP2) {
    lines.push('\u2500\u2500\u2500');
    lines.push(`Person 1 (pension owner): ${gbp(r.taxP1 ? r.taxP1.tax : 0)}`);
    lines.push(`Person 2 (spouse): ${gbp(r.taxP2.tax)}`);
    lines.push('(private pension + own state pension taxed on person 1;');
    lines.push(' spouse state pension on person 2; interest split equally)');
  }
  return lines.join('\n');
}

/**
 * Render a table cell value for a given column key.
 * Works for both annual summary rows and individual quarterly rows.
 */
export function colCell(key, r, p) {
  const oneOff = r.oneOff + r.houseSale;

  switch (key) {
    case 'year':
      return null; // handled separately by caller
    case 'salaryIncome':
      return r.salaryIncome > 0 ? cell(r.salaryIncome) : '\u2014';
    case 'pensionDrawn':
      return cell(r.pensionDrawn);
    case 'statePension':
      return r.statePensionIncome > 0 ? cell(r.statePensionIncome) : '\u2014';
    case 'savingsInterest':
      return cell(r.savingsInterest);
    case 'oneOff': {
      if (oneOff === 0) return '\u2014';
      const matchEvents = r.fq !== undefined
        ? p.events.filter(e => Math.abs(e.fractYear - r.fq) < 0.01)
        : p.events.filter(e => Math.floor(e.fractYear) === r.year);
      const tip = oneOffTooltip(matchEvents, r.houseSale, p);
      const display = cell(oneOff);
      return tip
        ? `<span class="has-tip" title="${tip.replace(/"/g, '&quot;')}">${display}</span>`
        : display;
    }
    case 'totalIncome':
      return `<strong>${cell(r.totalIncome)}</strong>`;
    case 'mortgage':
      return r.mortgage > 0 ? cell(r.mortgage) : '\u2014';
    case 'rent':
      return r.rent > 0 ? cell(r.rent) : '\u2014';
    case 'housePurchase':
      return r.housePurchase > 0 ? cell(r.housePurchase) : '\u2014';
    case 'livingSpend':
      return cell(r.targetSpend);
    case 'taxableIncome':
      return r.taxableIncome > 0 ? cell(r.taxableIncome) : '\u2014';
    case 'tax': {
      if (r.taxableIncome <= 0 && (!r.tax || r.tax <= 0)) return '\u2014';
      const tip = taxTooltip(r, p);
      return `<span class="has-tip" title="${tip.replace(/"/g, '&quot;')}">${cell(r.tax)}</span>`;
    }
    case 'totalOutgoings':
      return `<strong>${cell(r.totalOutgoings)}</strong>`;
    case 'pensionPot':
      return cell(r.pensionStart);
    case 'pensionGrowth':
      return r.pensionGrowth !== 0 ? cell(r.pensionGrowth) : '\u2014';
    case 'pensionWithdrawals':
      // Shown as an outflow (but not red) so pot + growth + withdrawals reads
      // straight across to the next period's opening pot.
      return r.pensionDrawn !== 0 ? gbp(-r.pensionDrawn) : '\u2014';
    case 'savingsEnd':
      return `<strong>${cell(r.savingsEnd)}</strong>`;
    default:
      return '\u2014';
  }
}
