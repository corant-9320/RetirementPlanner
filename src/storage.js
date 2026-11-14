/** Scenario persistence with a versioned, JSON-only localStorage schema. */

export const STORAGE_KEY = 'retirementPlanner_saves';
export const STORAGE_SCHEMA_VERSION = 1;

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

/** Validate the serialisable shape returned by snapshotForm(). */
export function validateFormSnapshot(value) {
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
  };
}

function cloneScenario(value) {
  const snapshot = cloneFormSnapshot(value);
  if (!snapshot) return null;
  if (Object.hasOwn(value, 'savedAt')) {
    if (typeof value.savedAt !== 'string') return null;
    snapshot.savedAt = value.savedAt;
  }
  return snapshot;
}

/**
 * Convert either the legacy root scenario map or a v1 document to schema v1.
 * This helper is pure and returns null rather than throwing for malformed data.
 */
export function migrateStorage(value) {
  try {
    if (!isRecord(value)) return null;
    const source = value.version === STORAGE_SCHEMA_VERSION
      ? value.scenarios
      : (!Object.hasOwn(value, 'version') ? value : null);
    if (!isRecord(source)) return null;

    const scenarios = Object.create(null);
    for (const [name, scenario] of Object.entries(source)) {
      if (!name || !isRecord(scenario)) return null;
      const clone = cloneScenario(scenario);
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
  if (text === null) return { ok: true, missing: true, document: { version: 1, scenarios: {} } };
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
