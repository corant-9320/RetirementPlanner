import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateAnnual } from '../src/annual.js';

const flows = [
  'salaryIncome', 'pensionDrawn', 'statePensionIncome', 'savingsInterest',
  'oneOff', 'houseSale', 'totalIncome', 'mortgage', 'rent', 'housePurchase',
  'targetSpend', 'taxableIncome', 'tax', 'taxPensionIncome',
  'taxSavingsInterest', 'taxPsaUsed', 'taxBasic', 'taxHigher',
  'taxAdditional', 'totalOutgoings',
];
function quarter(year, value, balances, taxP2 = null) {
  return {
    year,
    ...Object.fromEntries(flows.map(field => [field, value])),
    taxP1: { taxable: value, tax: value, psaUsed: value, basic: value,
      higher: value, additional: value },
    taxP2,
    ...balances,
  };
}

test('aggregateAnnual sums flows, tax people, and carries boundary balances', () => {
  const first = quarter(2027, 1, { pensionStart: 100, pensionEnd: 90, savingsEnd: 20 });
  const second = quarter(2027, 2, { pensionStart: 90, pensionEnd: 70, savingsEnd: 30 });
  const annual = aggregateAnnual([first, second, quarter(2026, 4,
    { pensionStart: 200, pensionEnd: 180, savingsEnd: 10 })]);
  assert.deepEqual(annual.map(result => result.year), [2026, 2027]);
  assert.equal(annual[1].salaryIncome, 3);
  assert.equal(annual[1].taxP1.tax, 3);
  assert.equal(annual[1].taxP2, null);
  assert.equal(annual[1].pensionStart, 100);
  assert.equal(annual[1].pensionEnd, 70);
  assert.equal(annual[1].savingsEnd, 30);
  assert.equal(annual[1].quarters.length, 2);
});

test('aggregateAnnual handles empty input without mutation', () => {
  const input = [];
  assert.deepEqual(aggregateAnnual(input), []);
  assert.deepEqual(input, []);
});
