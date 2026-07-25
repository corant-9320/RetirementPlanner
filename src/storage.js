/**
 * Scenario save/load/delete using localStorage.
 */

const STORAGE_KEY = 'retirementPlanner_saves';

export function allSaves() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function persistSaves(saves) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
}

export function refreshSaveSelect(selectEl) {
  const current = selectEl.value;
  selectEl.innerHTML = '<option value="">\u2014 load \u2014</option>';
  const saves = allSaves();
  Object.keys(saves)
    .sort()
    .forEach(name => {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      if (name === current) o.selected = true;
      selectEl.appendChild(o);
    });
}

/**
 * Save a scenario to localStorage.
 * @param {string} name - Scenario name
 * @param {object} params - readParams() result (includes _fieldCurrency, _rawValues, etc.)
 * @param {Array} events - Current one-off events array
 */
export function saveScenario(name, params, events) {
  const saves = allSaves();
  saves[name] = {
    fieldCurrency: params._fieldCurrency,
    rawValues: params._rawValues,
    plainValues: params._plainValues,
    selectValues: params._selectValues,
    events,
    savedAt: new Date().toISOString(),
  };
  persistSaves(saves);
}

/**
 * Load a scenario from localStorage.
 * @param {string} name - Scenario name
 * @returns {object|null} The saved data, or null if not found
 */
export function loadScenario(name) {
  const saves = allSaves();
  return saves[name] || null;
}

/**
 * Delete a scenario from localStorage.
 * @param {string} name - Scenario name
 */
export function deleteScenario(name) {
  const saves = allSaves();
  delete saves[name];
  persistSaves(saves);
}
