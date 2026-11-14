import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  STORAGE_SCHEMA_VERSION,
  isRecord,
  validateFormSnapshot,
  cloneFormSnapshot,
  migrateStorage,
  validateStorage,
  allSaves,
  persistSaves,
  saveScenario,
  loadScenario,
  deleteScenario,
} from '../src/storage.js';

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function snapshot() {
  return {
    fieldCurrency: { salary: 'GBP' },
    rawValues: { salary: '1000' },
    plainValues: { monthsWork: '12' },
    selectValues: { drawdownQ: '0.25' },
    events: [{ fractYear: 2030.25, amount: 500, description: 'Gift', currency: 'GBP' }],
  };
}

test('record and snapshot guards reject malformed values', () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord(null), false);
  assert.equal(validateFormSnapshot(snapshot()), true);
  assert.equal(validateFormSnapshot({ ...snapshot(), rawValues: [] }), false);
  assert.equal(validateFormSnapshot({ ...snapshot(), events: [new Date()] }), false);
  assert.equal(validateFormSnapshot({ ...snapshot(), events: [{ amount: Infinity }] }), false);
  assert.equal(validateFormSnapshot({ ...snapshot(), events: [{ foo: 'bar' }] }), false);
  assert.equal(validateFormSnapshot({ ...snapshot(), fieldCurrency: { salary: 'USD' } }), false);
});

test('cloning and legacy migration produce detached schema-v1 data', () => {
  const original = snapshot();
  const cloned = cloneFormSnapshot(original);
  original.rawValues.salary = 'changed';
  original.events[0].amount = 999;
  assert.equal(cloned.rawValues.salary, '1000');
  assert.equal(cloned.events[0].amount, 500);

  const legacy = { Plan: { ...snapshot(), savedAt: '2024-01-01T00:00:00.000Z' } };
  const migrated = migrateStorage(legacy);
  assert.equal(migrated.version, STORAGE_SCHEMA_VERSION);
  assert.equal(validateStorage(migrated), true);
  assert.equal(validateStorage(legacy), false);
  assert.deepEqual(migrated.scenarios.Plan, legacy.Plan);
  legacy.Plan.events[0].amount = 1;
  assert.equal(migrated.scenarios.Plan.events[0].amount, 500);
  assert.equal(migrateStorage({ version: 99, scenarios: {} }), null);
  assert.equal(migrateStorage({ Plan: { events: [] } }), null);
});

test('save writes schema v1, reports overwrites, and honors overwrite=false', () => {
  const storage = new MemoryStorage();
  const input = snapshot();
  assert.deepEqual(saveScenario('Plan', input, { storage }), { ok: true, overwritten: false });
  input.events[0].amount = 999;

  const stored = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(stored.version, 1);
  assert.equal(stored.scenarios.Plan.events[0].amount, 500);
  assert.equal(typeof stored.scenarios.Plan.savedAt, 'string');

  assert.deepEqual(saveScenario('Plan', snapshot(), { storage, overwrite: false }), {
    ok: false, error: 'already-exists', overwritten: false,
  });
  assert.deepEqual(saveScenario('Plan', snapshot(), { storage }), { ok: true, overwritten: true });
});

test('load migrates legacy data and always returns a detached value', () => {
  const legacy = { Legacy: snapshot() };
  const storage = new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(legacy) });
  const first = loadScenario('Legacy', storage);
  assert.deepEqual(first, snapshot());
  first.events[0].amount = 42;
  assert.equal(loadScenario('Legacy', storage).events[0].amount, 500);
  assert.equal(loadScenario('Missing', storage), null);
});

test('missing and malformed storage are safe and malformed data is not overwritten', () => {
  const missing = new MemoryStorage();
  assert.equal(loadScenario('Plan', missing), null);
  assert.deepEqual(allSaves(missing), {});

  const malformed = new MemoryStorage({ [STORAGE_KEY]: '{bad json' });
  assert.equal(loadScenario('Plan', malformed), null);
  assert.deepEqual(allSaves(malformed), {});
  assert.deepEqual(saveScenario('Plan', snapshot(), { storage: malformed }), {
    ok: false, error: 'malformed-storage',
  });
  assert.equal(malformed.getItem(STORAGE_KEY), '{bad json');
});

test('read and write failures return meaningful results without throwing', () => {
  const readFailure = { getItem() { throw new Error('blocked'); }, setItem() {} };
  assert.equal(loadScenario('Plan', readFailure), null);
  assert.deepEqual(saveScenario('Plan', snapshot(), { storage: readFailure }), {
    ok: false, error: 'read-failed',
  });

  const writeFailure = { getItem() { return null; }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(saveScenario('Plan', snapshot(), { storage: writeFailure }), {
    ok: false, error: 'write-failed', overwritten: false,
  });
  assert.deepEqual(deleteScenario('Plan', writeFailure), { ok: true, deleted: false });
  assert.deepEqual(persistSaves({ Plan: snapshot() }, writeFailure), {
    ok: false, error: 'write-failed',
  });
});

test('delete reports whether a scenario existed and persists schema v1', () => {
  const storage = new MemoryStorage();
  saveScenario('Plan', snapshot(), { storage });
  assert.deepEqual(deleteScenario('Plan', storage), { ok: true, deleted: true });
  assert.deepEqual(deleteScenario('Plan', storage), { ok: true, deleted: false });
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), { version: 1, scenarios: {} });
});

test('invalid mutation inputs are rejected without writing', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(saveScenario('', snapshot(), { storage }), { ok: false, error: 'invalid-name' });
  assert.deepEqual(saveScenario('Plan', {}, { storage }), { ok: false, error: 'invalid-snapshot' });
  assert.deepEqual(persistSaves({ Plan: {} }, storage), { ok: false, error: 'invalid-data' });
  assert.equal(storage.getItem(STORAGE_KEY), null);
});