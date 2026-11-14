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
const v3Order = v2Order.filter(k => k !== 'housePurchase').map(k => (k === 'rent' ? 'otherOutgoings' : k));
const preRemovalOrder = v3Order.filter(k => k !== 'otherOutgoings');

test('rent and house purchase are shown in the One-offs / Other column only', () => {
  for (const key of ['rent', 'housePurchase', 'otherOutgoings']) assert.ok(!defaults.includes(key), key);
  assert.ok(defaults.includes('pensionGrowth'));
  assert.ok(!defaults.includes('pensionWithdrawals'));
  assert.equal(ALL_COLUMNS.find(column => column.key === 'oneOff').label, 'One-offs / Other');
});

test('saved orders from earlier column sets keep their layout and are upgraded', () => {
  const withoutMerged = order => order.filter(k => !['rent', 'housePurchase', 'otherOutgoings', 'pensionWithdrawals'].includes(k));

  // Other is dropped; One-offs keeps its place.
  const fromV3 = migrateColOrder(v3Order);
  assert.equal(isValidColOrder(fromV3), true);
  assert.deepEqual(fromV3, withoutMerged(v3Order));
  assert.deepEqual(loadColOrder(new MemoryStorage(JSON.stringify(v3Order))), fromV3);

  // Rent and House Purchase are dropped.
  const fromV2 = migrateColOrder(v2Order);
  assert.deepEqual(fromV2, withoutMerged(v2Order));
  assert.deepEqual(loadColOrder(new MemoryStorage(JSON.stringify(v2Order))), fromV2);

  // The oldest set also gains the pension columns straight after the pot.
  const fromV1 = migrateColOrder(v1Order);
  assert.equal(isValidColOrder(fromV1), true);
  const pot = fromV1.indexOf('pensionPot');
  assert.deepEqual(fromV1.slice(pot, pot + 2), ['pensionPot', 'pensionGrowth']);
  assert.deepEqual(loadColOrder(new MemoryStorage(JSON.stringify(v1Order))), fromV1);

  // The pre-removal current order drops only Pension Withdrawals.
  const fromPreRemoval = migrateColOrder(preRemovalOrder);
  assert.equal(isValidColOrder(fromPreRemoval), true);
  assert.deepEqual(fromPreRemoval, preRemovalOrder.filter(k => k !== 'pensionWithdrawals'));
  assert.deepEqual(loadColOrder(new MemoryStorage(JSON.stringify(preRemovalOrder))), fromPreRemoval);

  // Older orders also end without the retired display key.
  const withoutRetired = order => order.filter(k => !['rent', 'housePurchase', 'otherOutgoings', 'pensionWithdrawals'].includes(k));
  assert.deepEqual(migrateColOrder(v2Order), withoutRetired(v2Order));
  assert.deepEqual(loadColOrder(new MemoryStorage(JSON.stringify(v2Order))), withoutRetired(v2Order));

  assert.equal(migrateColOrder(custom), null);
  assert.equal(migrateColOrder(v3Order.slice(1)), null);
  assert.equal(migrateColOrder(null), null);
});

test('One-offs / Other nets receipts against rent and purchase, with a signed breakdown', () => {
  const p = { eurGbp: 0.8, events: [{ fractYear: 2030.25, amount: 1000, description: 'Gift', currency: 'GBP' }] };
  const row = { year: 2030, oneOff: 1000, houseSale: 300000, rent: 3000, housePurchase: 250000 };
  const html = colCell('oneOff', row, p);
  assert.match(html, />£48,000</);
  assert.match(html, /title="Gift: £1,000\nHouse sale \(equity → cash\): £300,000\nRent: −£3,000\nHouse purchase: −£250,000"/);

  const costOnly = colCell('oneOff', { year: 2031, oneOff: 0, houseSale: 0, rent: 6000, housePurchase: 0 }, p);
  assert.match(costOnly, /class="neg">−£6,000/);
  assert.equal(colCell('oneOff', { year: 2032, oneOff: 0, houseSale: 0, rent: 0, housePurchase: 0 }, p), '\u2014');
});
