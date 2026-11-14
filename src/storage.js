/** Scenario persistence with a versioned, JSON-only localStorage schema. */

export const STORAGE_KEY = 'retirementPlanner_saves';
export const STORAGE_SCHEMA_VERSION = 2;

/**
 * Values shown by the original single drawdown fields in index.html. Used when
 * a v1 snapshot predates one of those fields, matching what restore displayed.
 */
const V1_DRAWDOWN_DEFAULTS = Object.freeze({ year: '2045', quarter: '0', rate: '5.0' });

export function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function isStringRecord(value) {
  return isRecord(value) && Object.values(value).every(item => typeof item === 'string');
}

function isCurrencyRecord(value) {
  return isRecord(value) && Object.values(value).every(item => item === 'GBP' || item === 'EUR');
}

function isEvent(value) {
  return isRecord(value) &&
    typeof value.fractYear === 'number' && Number.isFinite(value.fractYear) &&
    typeof value.amount === 'number' && Number.isFinite(value.amount) &&
    typeof value.description === 'string' &&
    (value.currency === 'GBP' || value.currency === 'EUR');
}

function isDrawdownLine(value) {
  return isRecord(value) &&
    typeof value.year === 'string' &&
    typeof value.quarter === 'string' &&
    typeof value.rate === 'string';
}

/** Schema-v1 snapshot: no drawdown list; one drawdown held in plain/select values. */
function validateFormSnapshotV1(value) {
  try {
    return isRecord(value) &&
      isCurrencyRecord(value.fieldCurrency) &&
      isStringRecord(value.rawValues) &&
      isStringRecord(value.plainValues) &&
      isStringRecord(value.selectValues) &&
      Array.isArray(value.events) && value.events.every(isEvent);
  } catch {
    return false;
  }
}

/** Validate the serialisable shape returned by snapshotForm(). */
export function validateFormSnapshot(value) {
  try {
    return validateFormSnapshotV1(value) &&
      Array.isArray(value.drawdowns) && value.drawdowns.every(isDrawdownLine);
  } catch {
    return false;
  }
}

export const isValidFormSnapshot = validateFormSnapshot;

/** Return a detached snapshot, or null for an invalid value. */
export function cloneFormSnapshot(value) {
  if (!validateFormSnapshot(value)) return null;
  return {
    fieldCurrency: { ...value.fieldCurrency },
    rawValues: { ...value.rawValues },
    plainValues: { ...value.plainValues },
    selectValues: { ...value.selectValues },
    events: value.events.map(event => ({ ...event })),
    drawdowns: value.drawdowns.map(line => ({ year: line.year, quarter: line.quarter, rate: line.rate })),
  };
}

/**
 * Convert a schema-v1 snapshot (single drawdownYear/drawdownQ/drawdown fields)
 * into the current shape with a one-line drawdown list. Pure; returns a
 * detached value, or null when the input is not a valid v1 snapshot. Any
 * savedAt is carried over unchanged.
 */
export function migrateSnapshotV1(value) {
  if (!validateFormSnapshotV1(value)) return null;
  const { drawdownYear, drawdown, ...plainValues } = value.plainValues;
  const { drawdownQ, ...selectValues } = value.selectValues;
  const migrated = {
    fieldCurrency: { ...value.fieldCurrency },
    rawValues: { ...value.rawValues },
    plainValues,
    selectValues,
    events: value.events.map(event => ({ ...event })),
    drawdowns: [{
      year: drawdownYear ?? V1_DRAWDOWN_DEFAULTS.year,
      quarter: drawdownQ ?? V1_DRAWDOWN_DEFAULTS.quarter,
      rate: drawdown ?? V1_DRAWDOWN_DEFAULTS.rate,
    }],
  };
  if (Object.hasOwn(value, 'savedAt')) migrated.savedAt = value.savedAt;
  return migrated;
}

function cloneScenario(value, sourceVersion = STORAGE_SCHEMA_VERSION) {
  const current = sourceVersion === STORAGE_SCHEMA_VERSION ? value : migrateSnapshotV1(value);
  if (!current) return null;
  const snapshot = cloneFormSnapshot(current);
  if (!snapshot) return null;
  if (Object.hasOwn(value, 'savedAt')) {
    if (typeof value.savedAt !== 'string') return null;
    snapshot.savedAt = value.savedAt;
  }
  return snapshot;
}

/**
 * Convert the legacy root scenario map (unversioned, v1 snapshot shape), a v1
 * document, or a v2 document to the current schema. This helper is pure and
 * returns null rather than throwing for malformed data.
 */
export function migrateStorage(value) {
  try {
    if (!isRecord(value)) return null;
    let source = null;
    let sourceVersion = null;
    if (!Object.hasOwn(value, 'version')) {
      source = value;
      sourceVersion = 1;
    } else if (value.version === 1 || value.version === STORAGE_SCHEMA_VERSION) {
      source = value.scenarios;
      sourceVersion = value.version;
    }
    if (!isRecord(source)) return null;

    const scenarios = Object.create(null);
    for (const [name, scenario] of Object.entries(source)) {
      if (!name || !isRecord(scenario)) return null;
      const clone = cloneScenario(scenario, sourceVersion);
      if (!clone) return null;
      scenarios[name] = clone;
    }
    return { version: STORAGE_SCHEMA_VERSION, scenarios };
  } catch {
    return null;
  }
}

/** Validate an already-versioned v1 storage document without accessing the DOM. */
export function validateStorage(value) {
  try {
    return isRecord(value) && value.version === STORAGE_SCHEMA_VERSION && migrateStorage(value) !== null;
  } catch {
    return false;
  }
}

export const validateStorageDocument = validateStorage;
export const migrateStorageData = migrateStorage;

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage; } catch { return undefined; }
}

function readDocument(storage) {
  const target = getStorage(storage);
  if (!target || typeof target.getItem !== 'function') {
    return { ok: false, error: 'storage-unavailable' };
  }
  let text;
  try { text = target.getItem(STORAGE_KEY); }
  catch { return { ok: false, error: 'read-failed' }; }
  if (text === null) return { ok: true, missing: true, document: { version: STORAGE_SCHEMA_VERSION, scenarios: {} } };
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return { ok: false, error: 'malformed-storage' }; }
  const document = migrateStorage(parsed);
  return document
    ? { ok: true, missing: false, document }
    : { ok: false, error: 'malformed-storage' };
}

function writeDocument(document, storage) {
  const target = getStorage(storage);
  if (!target || typeof target.setItem !== 'function') {
    return { ok: false, error: 'storage-unavailable' };
  }
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(document));
    return { ok: true };
  } catch {
    return { ok: false, error: 'write-failed' };
  }
}

/** Compatibility view of valid saves. Invalid or inaccessible storage is empty. */
export function allSaves(storage) {
  const read = readDocument(storage);
  if (!read.ok) return {};
  return Object.fromEntries(Object.entries(read.document.scenarios).map(
    ([name, scenario]) => [name, cloneScenario(scenario)]
  ));
}

/** Safely persist a scenario map or v1 document. */
export function persistSaves(saves, storage) {
  const document = migrateStorage(saves);
  if (!document) return { ok: false, error: 'invalid-data' };
  return writeDocument(document, storage);
}

export function refreshSaveSelect(selectEl, storage) {
  const current = selectEl.value;
  selectEl.innerHTML = '<option value="">\u2014 load \u2014</option>';
  const saves = allSaves(storage);
  Object.keys(saves).sort().forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (name === current) option.selected = true;
    selectEl.appendChild(option);
  });
}

/**
 * Save a FormSnapshot. Returns overwrite information and never throws.
 * Set options.overwrite=false to reject an existing name.
 */
export function saveScenario(name, snapshot, options = {}) {
  const value = cloneFormSnapshot(snapshot);
  const settings = isRecord(options) ? options : {};
  if (typeof name !== 'string' || !name.trim()) return { ok: false, error: 'invalid-name' };
  if (!value) return { ok: false, error: 'invalid-snapshot' };

  const read = readDocument(settings.storage);
  if (!read.ok) return { ok: false, error: read.error };
  const overwritten = Object.hasOwn(read.document.scenarios, name);
  if (overwritten && settings.overwrite === false) {
    return { ok: false, error: 'already-exists', overwritten: false };
  }
  read.document.scenarios[name] = { ...value, savedAt: new Date().toISOString() };
  const written = writeDocument(read.document, settings.storage);
  return written.ok ? { ok: true, overwritten } : { ...written, overwritten: false };
}

/** Load a detached scenario, or null when missing, malformed, or inaccessible. */
export function loadScenario(name, storage) {
  if (typeof name !== 'string' || !name) return null;
  const read = readDocument(storage);
  if (!read.ok) return null;
  return cloneScenario(read.document.scenarios[name]) || null;
}

/** Delete a scenario and return a non-throwing result. */
export function deleteScenario(name, storage) {
  if (typeof name !== 'string' || !name) return { ok: false, error: 'invalid-name' };
  const read = readDocument(storage);
  if (!read.ok) return { ok: false, error: read.error };
  const deleted = Object.hasOwn(read.document.scenarios, name);
  if (!deleted) return { ok: true, deleted: false };
  delete read.document.scenarios[name];
  const written = writeDocument(read.document, storage);
  return written.ok ? { ok: true, deleted: true } : { ...written, deleted: false };
}
