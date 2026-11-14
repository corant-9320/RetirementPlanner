import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_COLUMNS,
  COL_ORDER_KEY,
  isValidColOrder,
  validateColOrder,
  normalizeColOrder,
  migrateColOrder,
  loadColOrder,
  saveColOrder,
  orderedCols,
  colCell,
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
  const normalized = normalizeColOrder(['tax', 'year', 'tax', 'unknown', 'mortgage']);
  assert.equal(normalized[0], 'year');
  assert.deepEqual(normalized.slice(1, 3), ['tax', 'mortgage']);
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

// Saved custom orders from earlier column sets (year first, rest reversed).
const v1Order = ['year', 'savingsEnd', 'pensionPot', 'totalOutgoings', 'tax', 'taxableIncome',
  'livingSpend', 'housePurchase', 'rent', 'mortgage', 'totalIncome', 'oneOff',
  'savingsInterest', 'statePension', 'pensionDrawn', 'salaryIncome'];
const v2Order = ['year', 'savingsEnd', 'pensionWithdrawals', 'pensionGrowth', 'pensionPot',
  'totalOutgoings', 'tax', 'taxableIncome', 'livingSpend', 'housePurchase', 'rent', 'mortgage',
  'totalIncome', 'oneOff', 'savingsInterest', 'statePension', 'pensionDrawn', 'salaryIncome'];

test('Rent and House Purchase are replaced by a single Other column', () => {
  assert.ok(defaults.includes('otherOutgoings'));
  assert.ok(!defaults.includes('rent') && !defaults.includes('housePurchase'));
  assert.equal(defaults[defaults.indexOf('mortgage') + 1], 'otherOutgoings');
});

test('saved orders from earlier column sets keep their layout and are upgraded', () => {
  // Rent's position becomes Other; House Purchase is dropped.
  const fromV2 = migrateColOrder(v2Order);
  assert.equal(isValidColOrder(fromV2), true);
  assert.deepEqual(fromV2, v2Order.filter(k => k !== 'housePurchase').map(k => (k === 'rent' ? 'otherOutgoings' : k)));
  assert.deepEqual(loadColOrder(new MemoryStorage(JSON.stringify(v2Order))), fromV2);

  // The oldest set also gains the pension columns straight after the pot.
  const fromV1 = migrateColOrder(v1Order);
  assert.equal(isValidColOrder(fromV1), true);
  const pot = fromV1.indexOf('pensionPot');
  assert.deepEqual(fromV1.slice(pot, pot + 3), ['pensionPot', 'pensionGrowth', 'pensionWithdrawals']);
  assert.equal(fromV1[fromV1.indexOf('livingSpend') + 1], 'otherOutgoings');
  assert.deepEqual(loadColOrder(new MemoryStorage(JSON.stringify(v1Order))), fromV1);

  assert.equal(migrateColOrder(custom), null);
  assert.equal(migrateColOrder(v2Order.slice(1)), null);
  assert.equal(migrateColOrder(null), null);
});

test('Other shows rent plus house purchase with a breakdown, or a dash when zero', () => {
  const html = colCell('otherOutgoings', { rent: 3000, housePurchase: 50000, oneOff: 0, houseSale: 0 }, {});
  assert.match(html, /£53,000/);
  assert.match(html, /title="Rent: £3,000\nHouse purchase: £50,000"/);
  assert.equal(colCell('otherOutgoings', { rent: 0, housePurchase: 0, oneOff: 0, houseSale: 0 }, {}), '\u2014');
});
