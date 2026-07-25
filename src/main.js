/**
 * Application entry point.
 * Wires together form, simulation, rendering, storage, and events modules.
 */

import { currentFractYear } from './utils.js';
import { simulate } from './simulation.js';
import { drawChart } from './chart.js';
import { loadColOrder } from './columns.js';
import {
  readParams,
  attachMoneyFormatting,
  initCurrencyToggles,
  restoreForm,
  snapshotForm,
} from './form.js';
import { renderEvents, addEvent } from './events.js';
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
  expandedYears: new Set(),
  lastResults: null,
  lastParams: null,
  colOrder: loadColOrder(),
};

// ── DOM references ──────────────────────────────
const eventsListEl = document.getElementById('events-list');
const saveSelectEl = document.getElementById('save-select');
const saveNameEl = document.getElementById('save-name');
const saveStatusEl = document.getElementById('save-status');
const undoBtnEl = document.getElementById('btn-undo');
const redoBtnEl = document.getElementById('btn-redo');

// ── Status flash ────────────────────────────────
let statusTimer;
function setStatus(msg, isError) {
  saveStatusEl.textContent = msg;
  saveStatusEl.style.color = isError ? '#b00' : '#2a7a2a';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { saveStatusEl.textContent = ''; }, 3000);
}

// ── Init money formatting on existing inputs ────
document.querySelectorAll('.money-wrap input[type=text]').forEach(attachMoneyFormatting);

// ── Init currency toggles ───────────────────────
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

// ── Undo / redo history ─────────────────────────
const paramHistory = createHistory({
  capture: () => snapshotForm(state.events),
  apply: snap => {
    restoreForm(snap, restoredEvents => {
      state.events = restoredEvents;
      reRenderEvents();
    });
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

// ── Run simulation ──────────────────────────────
function runSimulation() {
  const p = readParams(state.events);
  const results = simulate(p, currentFractYear());
  renderResults(state, results, p);
}

document.getElementById('btn-run').addEventListener('click', runSimulation);

// ── Save / Load / Delete ────────────────────────
document.getElementById('btn-save').addEventListener('click', () => {
  const name = saveNameEl.value.trim();
  if (!name) { setStatus('Enter a scenario name first.', true); return; }
  const p = readParams(state.events);
  saveScenario(name, p, state.events);
  refreshSaveSelect(saveSelectEl);
  saveSelectEl.value = name;
  setStatus(`Saved "${name}"`);
});

document.getElementById('btn-load').addEventListener('click', () => {
  const name = saveSelectEl.value;
  if (!name) { setStatus('Select a scenario to load.', true); return; }
  const saved = loadScenario(name);
  if (!saved) { setStatus('Scenario not found.', true); return; }
  restoreForm(saved, restoredEvents => {
    state.events = restoredEvents;
    reRenderEvents();
  });
  saveNameEl.value = name;
  runSimulation();
  paramHistory.flush(); // loading a scenario is a single undoable step
  setStatus(`Loaded "${name}"`);
});

document.getElementById('btn-delete').addEventListener('click', () => {
  const name = saveSelectEl.value;
  if (!name) { setStatus('Select a scenario to delete.', true); return; }
  if (!confirm(`Delete scenario "${name}"?`)) return;
  deleteScenario(name);
  refreshSaveSelect(saveSelectEl);
  setStatus(`Deleted "${name}"`);
});

// ── Startup ─────────────────────────────────────
refreshSaveSelect(saveSelectEl);

// Redraw chart on resize
window.addEventListener('resize', () => {
  if (state.lastResults && state.lastParams) {
    const canvas = document.getElementById('nw-chart');
    drawChart(canvas, state.lastResults);
  }
});
