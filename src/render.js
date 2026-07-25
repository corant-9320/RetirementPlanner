/**
 * Results table rendering with drag-and-drop column reordering
 * and expandable annual→quarterly rows.
 */

import { gbp } from './utils.js';
import { drawChart } from './chart.js';
import { orderedCols, colCell, saveColOrder } from './columns.js';

/**
 * Render simulation results into the DOM.
 * @param {object} state - Mutable app state (lastResults, lastParams, expandedYears, colOrder)
 * @param {Array} results - Quarterly simulation results
 * @param {object} p - Parameters used for the run
 */
export function renderResults(state, results, p) {
  state.lastResults = results;
  state.lastParams = p;

  // Aggregate quarterly results into annual summaries
  const yearMap = {};
  results.forEach(r => {
    if (!yearMap[r.year]) yearMap[r.year] = [];
    yearMap[r.year].push(r);
  });
  const years = Object.keys(yearMap).map(Number).sort((a, b) => a - b);

  const annualResults = years.map(yr => {
    const qs = yearMap[yr];
    const last = qs[qs.length - 1];
    const first = qs[0];
    return {
      year: yr,
      quarters: qs,
      salaryIncome: qs.reduce((s, q) => s + q.salaryIncome, 0),
      pensionDrawn: qs.reduce((s, q) => s + q.pensionDrawn, 0),
      statePensionIncome: qs.reduce((s, q) => s + q.statePensionIncome, 0),
      savingsInterest: qs.reduce((s, q) => s + q.savingsInterest, 0),
      oneOff: qs.reduce((s, q) => s + q.oneOff, 0),
      houseSale: qs.reduce((s, q) => s + q.houseSale, 0),
      totalIncome: qs.reduce((s, q) => s + q.totalIncome, 0),
      mortgage: qs.reduce((s, q) => s + q.mortgage, 0),
      rent: qs.reduce((s, q) => s + q.rent, 0),
      housePurchase: qs.reduce((s, q) => s + q.housePurchase, 0),
      targetSpend: qs.reduce((s, q) => s + q.targetSpend, 0),
      taxableIncome: qs.reduce((s, q) => s + q.taxableIncome, 0),
      tax: qs.reduce((s, q) => s + q.tax, 0),
      taxPensionIncome: qs.reduce((s, q) => s + q.taxPensionIncome, 0),
      taxSavingsInterest: qs.reduce((s, q) => s + q.taxSavingsInterest, 0),
      taxPsaUsed: qs.reduce((s, q) => s + q.taxPsaUsed, 0),
      taxBasic: qs.reduce((s, q) => s + q.taxBasic, 0),
      taxHigher: qs.reduce((s, q) => s + q.taxHigher, 0),
      taxAdditional: qs.reduce((s, q) => s + q.taxAdditional, 0),
      taxP1: (() => {
        const qs2 = qs.filter(q => q.taxP1);
        if (!qs2.length) return null;
        return {
          taxable:    qs2.reduce((s, q) => s + q.taxP1.taxable, 0),
          tax:        qs2.reduce((s, q) => s + q.taxP1.tax, 0),
          psaUsed:    qs2.reduce((s, q) => s + q.taxP1.psaUsed, 0),
          basic:      qs2.reduce((s, q) => s + q.taxP1.basic, 0),
          higher:     qs2.reduce((s, q) => s + q.taxP1.higher, 0),
          additional: qs2.reduce((s, q) => s + q.taxP1.additional, 0),
        };
      })(),
      taxP2: (() => {
        const qs2 = qs.filter(q => q.taxP2);
        if (!qs2.length) return null;
        return {
          taxable:    qs2.reduce((s, q) => s + q.taxP2.taxable, 0),
          tax:        qs2.reduce((s, q) => s + q.taxP2.tax, 0),
          psaUsed:    qs2.reduce((s, q) => s + q.taxP2.psaUsed, 0),
          basic:      qs2.reduce((s, q) => s + q.taxP2.basic, 0),
          higher:     qs2.reduce((s, q) => s + q.taxP2.higher, 0),
          additional: qs2.reduce((s, q) => s + q.taxP2.additional, 0),
        };
      })(),
      totalOutgoings: qs.reduce((s, q) => s + q.totalOutgoings, 0),
      pensionStart: first.pensionStart,
      pensionEnd: last.pensionEnd,
      savingsEnd: last.savingsEnd,
    };
  });

  // Warnings
  const wDiv = document.getElementById('warnings');
  wDiv.innerHTML = '';
  annualResults.forEach(r => {
    if (r.savingsEnd < 0) {
      wDiv.innerHTML += `<div class="err-box">\uD83D\uDD34 ${r.year}: savings go negative (${gbp(r.savingsEnd)})</div>`;
    }
  });

  // Chart
  const canvas = document.getElementById('nw-chart');
  drawChart(canvas, results);

  // Table
  const cols = orderedCols(state.colOrder);

  let html = '<table><thead><tr>';
  cols.forEach(c => {
    const drag = c.draggable ? 'draggable="true"' : '';
    const align = c.key === 'year' ? 'text-align:left' : '';
    html += `<th data-col="${c.key}" ${drag} style="${align}">${c.label}</th>`;
  });
  html += '</tr></thead><tbody>';

  annualResults.forEach(r => {
    const exp = state.expandedYears.has(r.year);
    const rowClass = r.savingsEnd < 0 ? 'insolvent' : '';
    const icon = `<span class="expand" data-yr="${r.year}">${exp ? '\u25BC' : '\u25B6'}</span>`;

    html += `<tr class="${rowClass}">`;
    cols.forEach(c => {
      if (c.key === 'year') {
        html += `<td>${icon}${r.year}</td>`;
      } else {
        html += `<td>${colCell(c.key, r, p)}</td>`;
      }
    });
    html += '</tr>';

    if (exp) {
      r.quarters.forEach(q => {
        const qLabel = `Q${q.quarter + 1}`;
        html += '<tr class="qrow">';
        cols.forEach(c => {
          if (c.key === 'year') {
            html += `<td>${qLabel}</td>`;
          } else {
            html += `<td>${colCell(c.key, q, p)}</td>`;
          }
        });
        html += '</tr>';
      });
    }
  });

  html += '</tbody></table>';
  document.getElementById('results').innerHTML = html;

  // Drag-and-drop column reordering
  attachDragHandlers(state);

  // Expand/collapse year rows
  document.querySelectorAll('.expand').forEach(el => {
    el.addEventListener('click', e => {
      const yr = +e.target.dataset.yr;
      state.expandedYears.has(yr) ? state.expandedYears.delete(yr) : state.expandedYears.add(yr);
      renderResults(state, state.lastResults, state.lastParams);
    });
  });
}

function attachDragHandlers(state) {
  let dragSrcKey = null;

  document.querySelectorAll('th[draggable="true"]').forEach(th => {
    th.addEventListener('dragstart', e => {
      dragSrcKey = th.dataset.col;
      th.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    th.addEventListener('dragend', () => {
      th.classList.remove('dragging');
      document.querySelectorAll('th').forEach(h => h.classList.remove('drag-over'));
    });
    th.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('th').forEach(h => h.classList.remove('drag-over'));
      if (th.dataset.col !== dragSrcKey) th.classList.add('drag-over');
    });
    th.addEventListener('dragleave', () => th.classList.remove('drag-over'));
    th.addEventListener('drop', e => {
      e.preventDefault();
      th.classList.remove('drag-over');
      const destKey = th.dataset.col;
      if (!dragSrcKey || dragSrcKey === destKey) return;
      const srcIdx = state.colOrder.indexOf(dragSrcKey);
      const destIdx = state.colOrder.indexOf(destKey);
      if (srcIdx === -1 || destIdx === -1) return;
      state.colOrder.splice(srcIdx, 1);
      state.colOrder.splice(destIdx, 0, dragSrcKey);
      saveColOrder(state.colOrder);
      renderResults(state, state.lastResults, state.lastParams);
    });
  });
}
