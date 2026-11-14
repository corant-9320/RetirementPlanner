import test from 'node:test';
import assert from 'node:assert/strict';
import { validateParams } from '../src/validation.js';

function validParams() {
  return {
    eurGbp: 0.85, salary: 40000, monthsWork: 12, savings: 10000,
    savingsRate: 0.03, borrowRate: 0.08, pension: 200000,
    pensionRate: 0.04, drawdown: 0.04, drawdownStartFY: 2030,
    spUser: 10000, spUserFY: 2035, spUser2: 0, spUser2FY: 2035.25,
    spSpouse: 9000, spSpouseFY: 2036, spIncrease: 0.025,
    houseValue: 300000, houseGrowth: 0.02, mortgageRem: 50000,
    mortgagePay: 12000, mortgageCapital: 10000, houseSaleFY: 2040,
    rentMonthly: 1500, housePurchaseFY: 2041, housePurchasePrice: 200000,
    targetSpend: 30000, taxPayers: 2, pensionTaxFree: 0.25,
    taxBands: { personalAllowance: 12570, basicLimit: 50270, higherLimit: 125140,
      basicRate: 0.2, higherRate: 0.4, additionalRate: 0.45, savingsStartBand: 5000 },
    events: [{ fractYear: 2032.5, amount: -5000, description: 'Car', currency: 'GBP' }],
    endFY: 2050.75,
  };
}

const fields = errors => errors.map(error => error.field);

test('valid complete parameters have no errors', () => {
  assert.deepEqual(validateParams(validParams(), { startFY: 2026 }), []);
  assert.ok(fields(validateParams(validParams(), { startFY: 2026.1 })).includes('startFY'));
});

test('finite values, taxpayer count, rates, money, and mortgage are checked', () => {
  const params = validParams();
  Object.assign(params, { salary: NaN, savings: -100, pension: -1, taxPayers: 3,
    savingsRate: -1.01, drawdown: 1.01, mortgageCapital: 13000 });
  const result = fields(validateParams(params, { startFY: 2026 }));
  assert.ok(result.includes('salary'));
  assert.ok(!result.includes('savings'));
  for (const field of ['pension', 'taxPayers', 'savingsRate', 'drawdown', 'mortgageCapital']) {
    assert.ok(result.includes(field), field);
  }
});

test('tax bands, quarter dates, and horizon ordering are checked', () => {
  const params = validParams();
  params.drawdownStartFY = 2030.1;
  params.endFY = 2025.75;
  params.taxBands.personalAllowance = 60000;
  params.taxBands.higherLimit = 40000;
  params.taxBands.basicRate = 1.2;
  const result = fields(validateParams(params, { startFY: 2026 }));
  for (const field of ['drawdownStartFY', 'endFY', 'taxBands.basicLimit',
    'taxBands.higherLimit', 'taxBands.basicRate']) assert.ok(result.includes(field), field);

  const singleQuarter = validParams();
  singleQuarter.endFY = 2026;
  assert.equal(fields(validateParams(singleQuarter, { startFY: 2026 })).includes('endFY'), false);
});

test('events must have a quarter date, finite signed amount, description, and currency', () => {
  const params = validParams();
  params.events = [
    { fractYear: 2030.1, amount: -20, description: 'signed values are valid', currency: 'USD' },
    { fractYear: 2031, amount: Infinity, description: 12, currency: 'EUR' },
  ];
  const result = fields(validateParams(params));
  assert.ok(result.includes('events[0].fractYear'));
  assert.ok(!result.includes('events[0].amount'));
  assert.ok(result.includes('events[0].currency'));
  assert.ok(result.includes('events[1].amount'));
  assert.ok(result.includes('events[1].description'));
});

test('missing objects and numeric values produce errors rather than throwing', () => {
  const params = validParams();
  delete params.salary;
  params.taxBands = null;
  params.events = 'not events';
  const result = fields(validateParams(params));
  assert.ok(result.includes('salary'));
  assert.ok(result.includes('taxBands'));
  assert.ok(result.includes('events'));
  assert.deepEqual(validateParams(null), [{ field: 'params', message: 'must be an object' }]);
});
