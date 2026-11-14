import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  STORAGE_SCHEMA_VERSION,
  isRecord,
  validateFormSnapshot,
  cloneFormSnapshot,
  migrateStorage,
  migrateSnapshotV1,
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
    selectValues: { spUserQ: '0.5' },
    events: [{ fractYear: 2030.25, amount: 500, description: 'Gift', currency: 'GBP' }],
    drawdowns: [
      { year: '2044', quarter: '0.25', rate: '3.5' },
      { year: '2050', quarter: '0', rate: '6.0' },
    ],
  };
}

/** Schema-v1 snapshot: a single drawdown held in plain/select values. */
function v1Snapshot() {
  return {
    fieldCurrency: { salary: 'GBP' },
    rawValues: { salary: '1000' },
    plainValues: { monthsWork: '12', drawdownYear: '2044', drawdown: '3.5' },
    selectValues: { spUserQ: '0.5', drawdownQ: '0.25' },
    events: [{ fractYear: 2030.25, amount: 500, description: 'Gift', currency: 'GBP' }],
  };
}

const migratedV1 = () => ({
  ...v1Snapshot(),
  plainValues: { monthsWork: '12' },
  selectValues: { spUserQ: '0.5' },
  drawdowns: [{ year: '2044', quarter: '0.25', rate: '3.5' }],
});

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
  assert.equal(validateFormSnapshot(v1Snapshot()), false);
  assert.equal(validateFormSnapshot({ ...snapshot(), drawdowns: {} }), false);
  assert.equal(validateFormSnapshot({ ...snapshot(), drawdowns: [{ year: 2044, quarter: '0', rate: '3' }] }), false);
  assert.equal(validateFormSnapshot({ ...snapshot(), drawdowns: [] }), true);
});

test('cloning produces detached current-schema data', () => {
  const original = snapshot();
  const cloned = cloneFormSnapshot(original);
  original.rawValues.salary = 'changed';
  original.events[0].amount = 999;
  original.drawdowns[0].rate = '99';
  assert.equal(cloned.rawValues.salary, '1000');
  assert.equal(cloned.events[0].amount, 500);
  assert.equal(cloned.drawdowns[0].rate, '3.5');
  assert.equal(STORAGE_SCHEMA_VERSION, 2);
});

test('v1 snapshots migrate their single drawdown into a one-line list', () => {
  const original = v1Snapshot();
  const migrated = migrateSnapshotV1(original);
  assert.deepEqual(migrated, migratedV1());
  assert.equal(validateFormSnapshot(migrated), true);
  migrated.events[0].amount = 1;
  assert.equal(original.events[0].amount, 500);
  assert.deepEqual(original, v1Snapshot());

  // Fields missing from very old saves fall back to the former form defaults.
  const sparse = { ...v1Snapshot(), plainValues: {}, selectValues: {} };
  assert.deepEqual(migrateSnapshotV1(sparse).drawdowns, [{ year: '2045', quarter: '0', rate: '5.0' }]);
  assert.equal(migrateSnapshotV1({ events: [] }), null);
});

test('legacy maps and v1 documents migrate to detached schema-v2 data', () => {
  const savedAt = '2024-01-01T00:00:00.000Z';
  const legacy = { Plan: { ...v1Snapshot(), savedAt } };
  const migrated = migrateStorage(legacy);
  assert.equal(migrated.version, STORAGE_SCHEMA_VERSION);
  assert.equal(validateStorage(migrated), true);
  assert.equal(validateStorage(legacy), false);
  assert.deepEqual(migrated.scenarios.Plan, { ...migratedV1(), savedAt });
  legacy.Plan.events[0].amount = 1;
  assert.equal(migrated.scenarios.Plan.events[0].amount, 500);

  const v1Doc = { version: 1, scenarios: { Plan: { ...v1Snapshot(), savedAt } } };
  assert.equal(validateStorage(v1Doc), false);
  const fromV1Doc = migrateStorage(v1Doc);
  assert.equal(fromV1Doc.version, 2);
  assert.deepEqual(fromV1Doc.scenarios.Plan, { ...migratedV1(), savedAt });

  const v2Doc = { version: 2, scenarios: { Plan: { ...snapshot(), savedAt } } };
  assert.equal(validateStorage(v2Doc), true);
  assert.deepEqual(migrateStorage(v2Doc).scenarios.Plan, v2Doc.scenarios.Plan);

  // A v1-shaped scenario inside a v2 document is malformed, and vice versa.
  assert.equal(migrateStorage({ version: 2, scenarios: { Plan: v1Snapshot() } }), null);
  assert.equal(migrateStorage({ version: 99, scenarios: {} }), null);
  assert.equal(migrateStorage({ Plan: { events: [] } }), null);
});

test('loading from v1 storage returns migrated data without rewriting storage', () => {
  const text = JSON.stringify({ version: 1, scenarios: { Plan: v1Snapshot() } });
  const storage = new MemoryStorage({ [STORAGE_KEY]: text });
  assert.deepEqual(loadScenario('Plan', storage), migratedV1());
  assert.equal(storage.getItem(STORAGE_KEY), text);

  // The next save upgrades the whole document, keeping the other scenario.
  saveScenario('New', snapshot(), { storage });
  const stored = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(stored.version, 2);
  assert.deepEqual(stored.scenarios.Plan, migratedV1());
  assert.deepEqual(stored.scenarios.New.drawdowns, snapshot().drawdowns);
});

test('save writes schema v2, reports overwrites, and honors overwrite=false', () => {
  const storage = new MemoryStorage();
  const input = snapshot();
  assert.deepEqual(saveScenario('Plan', input, { storage }), { ok: true, overwritten: false });
  input.events[0].amount = 999;

  const stored = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(stored.version, 2);
  assert.equal(stored.scenarios.Plan.events[0].amount, 500);
  assert.equal(typeof stored.scenarios.Plan.savedAt, 'string');

  assert.deepEqual(saveScenario('Plan', snapshot(), { storage, overwrite: false }), {
    ok: false, error: 'already-exists', overwritten: false,
  });
  assert.deepEqual(saveScenario('Plan', snapshot(), { storage }), { ok: true, overwritten: true });
});

test('load migrates legacy data and always returns a detached value', () => {
  const legacy = { Legacy: v1Snapshot() };
  const storage = new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(legacy) });
  const first = loadScenario('Legacy', storage);
  assert.deepEqual(first, migratedV1());
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

test('delete reports whether a scenario existed and persists schema v2', () => {
  const storage = new MemoryStorage();
  saveScenario('Plan', snapshot(), { storage });
  assert.deepEqual(deleteScenario('Plan', storage), { ok: true, deleted: true });
  assert.deepEqual(deleteScenario('Plan', storage), { ok: true, deleted: false });
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), { version: 2, scenarios: {} });
});

test('invalid mutation inputs are rejected without writing', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(saveScenario('', snapshot(), { storage }), { ok: false, error: 'invalid-name' });
  assert.deepEqual(saveScenario('Plan', {}, { storage }), { ok: false, error: 'invalid-snapshot' });
  assert.deepEqual(persistSaves({ Plan: {} }, storage), { ok: false, error: 'invalid-data' });
  assert.equal(storage.getItem(STORAGE_KEY), null);
});