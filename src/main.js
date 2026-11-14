/**
 * Application entry point.
 * Wires together form, simulation, rendering, storage, and events modules.
 */

import { currentFractYear, fmtYQ } from './utils.js';
import { validateParams } from './validation.js';
import { simulate } from './simulation.js';
import { findMinimumDrawdown } from './optimise.js';
import { drawChart } from './chart.js';
import { loadColOrder } from './columns.js';
import {
  readParams,
  attachMoneyFormatting,
  initCurrencyToggles,
  initFormAccessibility,
  restoreForm,
  snapshotForm,
} from './form.js';
import { renderEvents, addEvent } from './events.js';
import { renderDrawdowns, addDrawdown, defaultDrawdownLines, drawdownControlId } from './drawdowns.js';
import { renderResults } from './render.js';
import { createHistory } from './history.js';
import {
  refreshSaveSelect,
  saveScenario,
  loadScenario,
  deleteScenario,
} from './storage.js';

// ── Application state ───────────────────────────
const state = {
  events: [],
  drawdowns: defaultDrawdownLines(),
  expandedYears: new Set(),
  lastResults: null,
  lastParams: null,
  colOrder: loadColOrder(),
};

// ── DOM references ──────────────────────────────
const eventsListEl = document.getElementById('events-list');
const drawdownsListEl = document.getElementById('drawdowns-list');
const saveSelectEl = document.getElementById('save-select');
const saveNameEl = document.getElementById('save-name');
const saveStatusEl = document.getElementById('save-status');
const formErrorsEl = document.getElementById('form-errors');
const undoBtnEl = document.getElementById('btn-undo');
const redoBtnEl = document.getElementById('btn-redo');

// ── Status flash ────────────────────────────────
let statusTimer;
function setStatus(msg, isError, durationMs = 3000) {
  saveStatusEl.textContent = msg;
  saveStatusEl.classList.toggle('status-error', Boolean(isError));
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { saveStatusEl.textContent = ''; }, durationMs);
}

const VALIDATION_FIELD_IDS = {
  spUserFY: 'spUserYear',
  spUser2FY: 'spUser2Year',
  spSpouseFY: 'spSpouseYear',
  houseSaleFY: 'houseSaleYear',
  housePurchaseFY: 'housePurchaseYear',
  'taxBands.personalAllowance': 'taxAllowance',
  'taxBands.basicLimit': 'taxBasicLimit',
  'taxBands.higherLimit': 'taxHigherLimit',
  'taxBands.basicRate': 'taxBasicRate',
  'taxBands.higherRate': 'taxHigherRate',
  'taxBands.additionalRate': 'taxAddRate',
  'taxBands.savingsStartBand': 'taxSavingsStartBand',
};

function controlIdFor(field) {
  const line = /^drawdowns\[(\d+)\]\.(startFY|rate)$/.exec(field || '');
  if (line) return drawdownControlId(Number(line[1]), line[2] === 'rate' ? 'rate' : 'year');
  if (field === 'drawdowns') return 'btn-add-drawdown';
  return VALIDATION_FIELD_IDS[field] || field;
}

function showValidationErrors(errors) {
  document.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
  formErrorsEl.replaceChildren();
  formErrorsEl.hidden = errors.length === 0;
  if (!errors.length) return;

  const heading = document.createElement('strong');
  heading.textContent = 'Please correct the following:';
  const list = document.createElement('ul');
  errors.forEach(error => {
    const item = document.createElement('li');
    const control = document.getElementById(controlIdFor(error.field));
    const label = control?.labels?.[0]?.textContent.trim()
      || control?.getAttribute('aria-label')
      || error.field || 'Simulation';
    item.textContent = `${label}: ${error.message}`;
    list.appendChild(item);
    if (control) control.setAttribute('aria-invalid', 'true');
  });
  formErrorsEl.append(heading, list);
}

function validatedParams() {
  const startFY = currentFractYear();
  const params = readParams(state.events, state.drawdowns);
  const errors = validateParams(params, { startFY });
  showValidationErrors(errors);
  return errors.length ? null : { params, startFY };
}

// ── Init money formatting on existing inputs ────
document.querySelectorAll('.money-wrap input[type=text]').forEach(attachMoneyFormatting);

// ── Init labels and currency toggles ─────────────
initFormAccessibility();
initCurrencyToggles();

// ── Events list helper ──────────────────────────
function reRenderEvents() {
  renderEvents(eventsListEl, state.events, onEventsMutated);
}

/** Events added/removed: re-render and record an undo step. */
function onEventsMutated() {
  reRenderEvents();
  paramHistory.record();
}

// ── Drawdown lines helper ───────────────────────
function reRenderDrawdowns() {
  renderDrawdowns(drawdownsListEl, state.drawdowns, {
    onChanged: onDrawdownsMutated,
    onOptimise: optimiseDrawdownLine,
  });
}

/** Drawdown lines added/removed: re-render and record an undo step. */
function onDrawdownsMutated() {
  reRenderDrawdowns();
  paramHistory.record();
}

/** Apply restored list state (from history or a loaded scenario). */
function applyRestoredLists(restoredEvents, restoredDrawdowns) {
  state.events = restoredEvents;
  state.drawdowns = restoredDrawdowns;
  reRenderEvents();
  reRenderDrawdowns();
}

reRenderDrawdowns();

// ── Undo / redo history ─────────────────────────
const paramHistory = createHistory({
  capture: () => snapshotForm(state.events, state.drawdowns),
  apply: snap => {
    restoreForm(snap, applyRestoredLists);
    // Keep displayed results in sync once a simulation has been run
    if (state.lastResults) runSimulation();
  },
  onChange: () => {
    undoBtnEl.disabled = !paramHistory.canUndo();
    redoBtnEl.disabled = !paramHistory.canRedo();
  },
});

undoBtnEl.disabled = true;
redoBtnEl.disabled = true;

undoBtnEl.addEventListener('click', () => {
  if (!paramHistory.undo()) setStatus('Nothing to undo.', true);
});
redoBtnEl.addEventListener('click', () => {
  if (!paramHistory.redo()) setStatus('Nothing to redo.', true);
});

// Any committed field change, quarter selection, or currency toggle is a step.
// (#drawdowns-list sits inside #form-grid.)
document.addEventListener('change', e => {
  if (e.target.closest('#form-grid, #events-list')) paramHistory.record();
});
document.addEventListener('click', e => {
  if (e.target.closest('.cur-toggle button')) paramHistory.record();
});

// Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo.
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const key = e.key.toLowerCase();
  const isUndo = key === 'z' && !e.shiftKey;
  const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
  if (!isUndo && !isRedo) return;

  e.preventDefault();
  // Commit whatever is being edited so it becomes its own history step
  const active = document.activeElement;
  if (active && active !== document.body && typeof active.blur === 'function') active.blur();
  paramHistory.flush();

  if (isUndo && !paramHistory.undo()) setStatus('Nothing to undo.', true);
  if (isRedo && !paramHistory.redo()) setStatus('Nothing to redo.', true);
});

// ── Add event button ────────────────────────────
document.getElementById('btn-add-event').addEventListener('click', () => {
  addEvent(state.events, onEventsMutated);
});

// ── Add drawdown line button ────────────────────
document.getElementById('btn-add-drawdown').addEventListener('click', () => {
  addDrawdown(state.drawdowns, onDrawdownsMutated);
});

// ── Run simulation ──────────────────────────────
function runSimulation() {
  const validated = validatedParams();
  if (!validated) {
    setStatus('Simulation not run: check the highlighted inputs.', true);
    formErrorsEl.focus();
    return false;
  }

  try {
    const results = simulate(validated.params, validated.startFY);
    renderResults(state, results, validated.params);
    return true;
  } catch (error) {
    showValidationErrors([{ field: '', message: error?.message || 'The simulation could not be run.' }]);
    setStatus('Simulation failed.', true);
    return false;
  }
}

document.getElementById('btn-run').addEventListener('click', runSimulation);

// ── Find the lowest drawdown that keeps savings positive ──
const OPTIMISE_STATUS_MS = 8000;

function drawdownFailureMessage(result, n) {
  const when = fmtYQ(result.shortfallFQ);
  switch (result.reason) {
    case 'before-drawdown':
      return `Savings go negative in ${when}, before drawdown line ${n} starts, so no rate on that line can prevent it.`;
    case 'no-effect':
      return `Savings go negative in ${when} and there is no pension pot to draw from.`;
    default:
      return `No rate up to 100% on drawdown line ${n} keeps savings above zero. The best (${result.bestPercent.toFixed(1)}%) still runs out in ${when}.`;
  }
}

/** "Find lowest" for one line: other lines and every other input stay fixed. */
function optimiseDrawdownLine(index) {
  const n = index + 1;
  // Commit any in-progress edit so the run uses what is on screen.
  paramHistory.flush();
  const validated = validatedParams();
  if (!validated) {
    setStatus('Drawdown not optimised: check the highlighted inputs.', true);
    formErrorsEl.focus();
    return;
  }

  const result = findMinimumDrawdown(validated.params, validated.startFY, index);
  if (!result.ok) {
    setStatus(drawdownFailureMessage(result, n), true, OPTIMISE_STATUS_MS);
    return;
  }

  state.drawdowns[index].rate = result.percent.toFixed(1);
  reRenderDrawdowns();
  paramHistory.flush(); // one undoable step
  runSimulation();
  setStatus(
    result.percent === 0
      ? `Savings stay above zero with no drawdown on line ${n}, so it is set to 0.0%.`
      : `Drawdown line ${n} set to ${result.percent.toFixed(1)}%, the lowest rate that keeps savings above zero.`,
    false,
    OPTIMISE_STATUS_MS,
  );
}

// ── Save / Load / Delete ────────────────────────
document.getElementById('btn-save').addEventListener('click', () => {
  const name = saveNameEl.value.trim();
  if (!name) { setStatus('Enter a scenario name first.', true); return; }
  if (!validatedParams()) {
    setStatus('Scenario not saved: check the highlighted inputs.', true);
    formErrorsEl.focus();
    return;
  }

  try {
    const snapshot = snapshotForm(state.events, state.drawdowns);
    let result = saveScenario(name, snapshot, { overwrite: false });
    if (result?.exists || result?.error === 'already-exists') {
      if (!confirm(`A scenario named "${name}" already exists. Overwrite it?`)) {
        setStatus('Save cancelled.');
        return;
      }
      result = saveScenario(name, snapshot, { overwrite: true });
    }
    if (result && result.ok === false) {
      setStatus(result.error || 'Scenario could not be saved.', true);
      return;
    }
    refreshSaveSelect(saveSelectEl);
    saveSelectEl.value = name;
    setStatus(`Saved "${name}"`);
  } catch (error) {
    setStatus(error?.message || 'Scenario could not be saved.', true);
  }
});

document.getElementById('btn-load').addEventListener('click', () => {
  const name = saveSelectEl.value;
  if (!name) { setStatus('Select a scenario to load.', true); return; }
  try {
    const result = loadScenario(name);
    if (!result || result.ok === false) {
      setStatus(result?.error || 'Scenario not found.', true);
      return;
    }
    const saved = result.snapshot ?? result.scenario ?? result.data ?? result.value ?? result;
    restoreForm(saved, applyRestoredLists);
    saveNameEl.value = name;
    const ran = runSimulation();
    paramHistory.flush(); // loading a scenario is a single undoable step
    setStatus(ran ? `Loaded "${name}"` : `Loaded "${name}"; correct the highlighted inputs.`, !ran);
  } catch (error) {
    setStatus(error?.message || 'Scenario could not be loaded.', true);
  }
});

document.getElementById('btn-delete').addEventListener('click', () => {
  const name = saveSelectEl.value;
  if (!name) { setStatus('Select a scenario to delete.', true); return; }
  if (!confirm(`Delete scenario "${name}"?`)) return;
  try {
    const result = deleteScenario(name);
    if (result && result.ok === false) {
      setStatus(result.error || 'Scenario could not be deleted.', true);
      return;
    }
    refreshSaveSelect(saveSelectEl);
    setStatus(`Deleted "${name}"`);
  } catch (error) {
    setStatus(error?.message || 'Scenario could not be deleted.', true);
  }
});

// ── Startup ─────────────────────────────────────
try {
  refreshSaveSelect(saveSelectEl);
} catch (error) {
  setStatus(error?.message || 'Saved scenarios could not be listed.', true);
}

// Redraw chart on resize
window.addEventListener('resize', () => {
  if (state.lastResults && state.lastParams) {
    const canvas = document.getElementById('nw-chart');
    drawChart(canvas, state.lastResults);
  }
});
