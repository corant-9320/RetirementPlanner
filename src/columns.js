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
  { key: 'savingsEnd', label: 'Savings (yr end)', draggable: true },
];

const COL_ORDER_KEY = 'retirementPlanner_colOrder';

export function loadColOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(COL_ORDER_KEY));
    if (Array.isArray(saved) && saved.length === ALL_COLUMNS.length) return saved;
  } catch { /* ignore */ }
  return ALL_COLUMNS.map(c => c.key);
}

export function saveColOrder(order) {
  localStorage.setItem(COL_ORDER_KEY, JSON.stringify(order));
}

/** Get ordered column descriptors based on current order array. */
export function orderedCols(colOrder) {
  return colOrder.map(key => ALL_COLUMNS.find(c => c.key === key)).filter(Boolean);
}

/** Build tooltip for one-off events cell. */
function oneOffTooltip(eventsInYear, houseSaleAmt, p) {
  const lines = [];
  eventsInYear.forEach(e => {
    const amt = e.currency === 'EUR' ? e.amount * p.eurGbp : e.amount;
    const label = e.description || '(no description)';
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
    case 'savingsEnd':
      return `<strong>${cell(r.savingsEnd)}</strong>`;
    default:
      return '\u2014';
  }
}
