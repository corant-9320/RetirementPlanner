/**
 * Results table rendering with drag-and-drop column reordering
 * and expandable annual→quarterly rows.
 */

import { gbp } from './utils.js';
import { aggregateAnnual } from './annual.js';
import { drawChart } from './chart.js';
import { orderedCols, colCell, saveColOrder, headerLines } from './columns.js';

function renderWarnings(annualResults) {
  const container = document.getElementById('warnings');
  container.replaceChildren();
  annualResults.forEach(result => {
    if (result.savingsEnd >= 0) return;
    const warning = document.createElement('div');
    warning.className = 'err-box';
    warning.textContent = `🔴 ${result.year}: savings go negative (${gbp(result.savingsEnd)})`;
    container.appendChild(warning);
  });
}

function renderEmptyResults() {
  const resultsEl = document.getElementById('results');
  const message = document.createElement('p');
  message.className = 'placeholder';
  message.textContent = 'The simulation returned no results. Check the parameters and run it again.';
  resultsEl.replaceChildren(message);
}

/** Render simulation results into the DOM. */
export function renderResults(state, results, p) {
  const safeResults = Array.isArray(results) ? results : [];
  state.lastResults = safeResults;
  state.lastParams = p;

  const annualResults = aggregateAnnual(safeResults);
  renderWarnings(annualResults);
  drawChart(document.getElementById('nw-chart'), safeResults);

  if (!safeResults.length) {
    renderEmptyResults();
    return;
  }

  const cols = orderedCols(state.colOrder);
  let html = '<table><thead><tr>';
  cols.forEach(column => {
    const drag = column.draggable ? 'draggable="true"' : '';
    const align = column.key === 'year' ? ' class="year-heading"' : '';
    // Labels are static strings from ALL_COLUMNS, so joining with <br> is safe.
    html += `<th data-col="${column.key}" ${drag}${align}>${headerLines(column.label).join('<br>')}</th>`;
  });
  html += '</tr></thead><tbody>';

  annualResults.forEach(result => {
    const expanded = state.expandedYears.has(result.year);
    const rowClass = result.savingsEnd < 0 ? ' class="insolvent"' : '';
    const label = expanded ? 'Hide' : 'Show';
    const icon = expanded ? '\u25BC' : '\u25B6';

    html += `<tr${rowClass}>`;
    cols.forEach(column => {
      if (column.key === 'year') {
        html += '<td>';
        html += `<button type="button" class="expand" data-yr="${result.year}" aria-expanded="${expanded}" aria-label="${label} quarterly details for ${result.year}">${icon}</button>`;
        html += `${result.year}</td>`;
      } else {
        html += `<td>${colCell(column.key, result, p)}</td>`;
      }
    });
    html += '</tr>';

    if (expanded) {
      result.quarters.forEach(quarter => {
        html += '<tr class="qrow">';
        cols.forEach(column => {
          if (column.key === 'year') {
            html += `<td>Q${quarter.quarter + 1}</td>`;
          } else {
            html += `<td>${colCell(column.key, quarter, p)}</td>`;
          }
        });
        html += '</tr>';
      });
    }
  });

  html += '</tbody></table>';
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = html;

  attachDragHandlers(state, resultsEl);
  resultsEl.querySelectorAll('.expand').forEach(button => {
    button.addEventListener('click', () => {
      const year = Number(button.dataset.yr);
      state.expandedYears.has(year)
        ? state.expandedYears.delete(year)
        : state.expandedYears.add(year);
      renderResults(state, state.lastResults, state.lastParams);
    });
  });
}

function attachDragHandlers(state, resultsEl) {
  let dragSrcKey = null;
  const headings = () => resultsEl.querySelectorAll('th');

  resultsEl.querySelectorAll('th[draggable="true"]').forEach(th => {
    th.addEventListener('dragstart', event => {
      dragSrcKey = th.dataset.col;
      th.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
    });
    th.addEventListener('dragend', () => {
      th.classList.remove('dragging');
      headings().forEach(heading => heading.classList.remove('drag-over'));
    });

    th.addEventListener('dragover', event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      headings().forEach(heading => heading.classList.remove('drag-over'));
      if (th.dataset.col !== dragSrcKey) th.classList.add('drag-over');
    });
    th.addEventListener('dragleave', () => th.classList.remove('drag-over'));
    th.addEventListener('drop', event => {
      event.preventDefault();
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
