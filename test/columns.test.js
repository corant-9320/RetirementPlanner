import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_COLUMNS,
  COL_ORDER_KEY,
  isValidColOrder,
  validateColOrder,
  normalizeColOrder,
  loadColOrder,
  saveColOrder,
  orderedCols,
} from '../src/columns.js';

class MemoryStorage {
  constructor(value = null) { this.value = value; }
  getItem(key) { return key === COL_ORDER_KEY ? this.value : null; }
  setItem(key, value) {
    assert.equal(key, COL_ORDER_KEY);
    this.value = value;
  }
}

const defaults = ALL_COLUMNS.map(column => column.key);
const custom = ['year', ...defaults.slice(1).reverse()];

test('order validation requires exact unique membership with year first', () => {
  assert.equal(isValidColOrder(defaults), true);
  assert.equal(validateColOrder(custom), true);
  assert.equal(isValidColOrder(['salaryIncome', ...defaults.filter(k => k !== 'salaryIncome')]), false);
  assert.equal(isValidColOrder([...defaults.slice(0, -1), defaults[1]]), false);
  assert.equal(isValidColOrder([...defaults, 'unknown']), false);
  assert.equal(isValidColOrder(defaults.slice(0, -1)), false);
  assert.equal(isValidColOrder(null), false);
});

test('normalization pins year, removes invalid duplicates, and appends missing keys', () => {
  const normalized = normalizeColOrder(['tax', 'year', 'tax', 'unknown', 'rent']);
  assert.equal(normalized[0], 'year');
  assert.deepEqual(normalized.slice(1, 3), ['tax', 'rent']);
  assert.equal(isValidColOrder(normalized), true);
  assert.deepEqual(normalizeColOrder(undefined), defaults);
  assert.notEqual(normalizeColOrder(undefined), normalizeColOrder(undefined));
});

test('load accepts only exact valid orders and returns detached defaults otherwise', () => {
  const validStorage = new MemoryStorage(JSON.stringify(custom));
  assert.deepEqual(loadColOrder(validStorage), custom);
  const loaded = loadColOrder(validStorage);
  loaded.push('mutation');
  assert.deepEqual(loadColOrder(validStorage), custom);

  for (const value of [
    '{bad',
    JSON.stringify(defaults.slice(1)),
    JSON.stringify([...defaults.slice(0, -1), defaults[1]]),
    JSON.stringify(['tax', ...defaults.filter(key => key !== 'tax')]),
  ]) {
    assert.deepEqual(loadColOrder(new MemoryStorage(value)), defaults);
  }
  assert.deepEqual(loadColOrder({ getItem() { throw new Error('blocked'); } }), defaults);
});

test('save validates and catches unavailable or failing storage writes', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(saveColOrder(custom, storage), { ok: true });
  assert.deepEqual(JSON.parse(storage.value), custom);

  const invalidStorage = new MemoryStorage();
  assert.deepEqual(saveColOrder(defaults.slice(1), invalidStorage), {
    ok: false, error: 'invalid-order',
  });
  assert.equal(invalidStorage.value, null);
  assert.deepEqual(saveColOrder(defaults, {}), {
    ok: false, error: 'storage-unavailable',
  });
  assert.deepEqual(saveColOrder(defaults, { setItem() { throw new Error('quota'); } }), {
    ok: false, error: 'write-failed',
  });
});

test('orderedCols always returns one complete valid descriptor set', () => {
  assert.deepEqual(orderedCols(custom).map(column => column.key), custom);
  const recovered = orderedCols(['tax', 'tax', 'bogus']).map(column => column.key);
  assert.equal(recovered[0], 'year');
  assert.equal(new Set(recovered).size, ALL_COLUMNS.length);
  assert.equal(recovered.length, ALL_COLUMNS.length);
});