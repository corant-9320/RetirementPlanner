import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, eventsForQuarter, statePensionForQuarter, taxYearForQuarter } from '../src/simulation.js';

function params(overrides = {}) {
  return {
    eurGbp: 0.8, salary: 0, monthsWork: 0, savings: 0, savingsRate: 0,
    borrowRate: 0, pension: 0, pensionRate: 0, drawdown: 0,
    drawdownStartFY: 2100, spUser: 0, spUserFY: 2100, spUser2: 0,
    spUser2FY: 2100, spSpouse: 0, spSpouseFY: 2100, spIncrease: 0,
    houseValue: 0, houseGrowth: 0, mortgageRem: 0, mortgagePay: 0,
    mortgageCapital: 0, houseSaleFY: 2100, rentMonthly: 0,
    housePurchaseFY: 2100, housePurchasePrice: 0, targetSpend: 0,
    taxPayers: 1, pensionTaxFree: 0,
    taxBands: { personalAllowance: 12570, basicLimit: 50270, higherLimit: 125140,
      basicRate: 0.2, higherRate: 0.4, additionalRate: 0.45, savingsStartBand: 5000 },
    events: [], endFY: 2026.75, ...overrides,
  };
}

function close(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}

test('explicit horizon is inclusive and a past horizon is guarded', () => {
  assert.deepEqual(simulate(params({ endFY: 2025.75 }), 2026), []);
  const results = simulate(params({ endFY: 2026.5 }), 2026);
  assert.deepEqual(results.map(result => result.fq), [2026, 2026.25, 2026.5]);
  const defaults = params();
  delete defaults.endFY;
  assert.equal(simulate(defaults, 2050.5).at(-1).fq, 2050.75);
});

test('cash-flow and balance invariants reconcile every quarter', () => {
  const results = simulate(params({ savings: 1000, salary: 40000, monthsWork: 6,
    targetSpend: 12000, savingsRate: 0.04 }), 2026);
  let opening = 1000;
  for (const result of results) {
    close(result.totalIncome, result.salaryIncome + result.pensionDrawn
      + result.statePensionIncome + result.savingsInterest + result.oneOff + result.houseSale);
    close(result.totalOutgoings, result.targetSpend + result.mortgage + result.rent
      + result.housePurchase + result.tax);
    close(result.savingsEnd, opening + result.totalIncome - result.totalOutgoings);
    opening = result.savingsEnd;
  }
  assert.equal(results[0].salaryIncome, 10000);
  assert.equal(results[1].salaryIncome, 10000);
  assert.equal(results[2].salaryIncome, 0);
});

test('events occur once at exact quarter timing with EUR conversion', () => {
  const events = [
    { fractYear: 2026.25, amount: 100, description: 'Gift', currency: 'GBP' },
    { fractYear: 2026.25, amount: -50, description: 'Bill', currency: 'EUR' },
    { fractYear: 2027, amount: 999, description: 'Beyond horizon', currency: 'GBP' },
  ];
  const snapshot = structuredClone(events);
  const results = simulate(params({ events }), 2026);
  assert.deepEqual(results.map(result => result.oneOff), [0, 60, 0, 0]);
  assert.deepEqual(events, snapshot);
  assert.equal(eventsForQuarter(events, 2026.25, 0.8), 60);
});

test('mortgage payments reduce capital and do not overpay the final quarter', () => {
  const results = simulate(params({ mortgageRem: 150, mortgagePay: 400,
    mortgageCapital: 400 }), 2026);
  assert.equal(results[0].mortgage, 100);
  assert.equal(results[0].mortgageLeft, 50);
  assert.equal(results[1].mortgage, 50);
  assert.equal(results[1].mortgageLeft, 0);
  assert.equal(results[2].mortgage, 0);
});

test('property growth, sale equity, rent, and replacement purchase have correct timing', () => {
  const results = simulate(params({ houseValue: 100000, houseGrowth: 0.04,
    houseSaleFY: 2026.25, rentMonthly: 1000, housePurchaseFY: 2026.5,
    housePurchasePrice: 50000 }), 2026);
  const valueAtSale = 100000 * (1.04 ** 0.25);
  close(results[0].houseVal, valueAtSale);
  close(results[1].houseSale, valueAtSale);
  assert.equal(results[1].rent, 3000);
  assert.equal(results[1].houseVal, 0);
  assert.equal(results[2].housePurchase, 50000);
  assert.equal(results[2].rent, 0);
  assert.equal(results[2].houseVal, 50000);
});

test('pension drawdown is taxed cumulatively in its starting quarter', () => {
  const taxBands = { personalAllowance: 0, basicLimit: 100000,
    higherLimit: 200000, basicRate: 0.2, higherRate: 0.4,
    additionalRate: 0.45, savingsStartBand: 0 };
  const [result] = simulate(params({ pension: 40000, drawdown: 1,
    drawdownStartFY: 2026, taxBands, endFY: 2026 }), 2026);
  assert.equal(result.pensionDrawn, 10000);
  assert.equal(result.taxPensionIncome, 10000);
  assert.equal(result.tax, 2000);
  assert.equal(result.taxP1.tax, 2000);
  assert.equal(result.taxP2, null);
});

test('state pension and UK tax-year helpers respect quarter boundaries', () => {
  assert.equal(statePensionForQuarter(12000, 2026.25, 2026, 0.03), 0);
  assert.equal(statePensionForQuarter(12000, 2026.25, 2026.25, 0.03), 3000);
  close(statePensionForQuarter(12000, 2026.25, 2027.25, 0.03), 3090);
  assert.equal(taxYearForQuarter(2026), 2025);
  assert.equal(taxYearForQuarter(2026.25), 2026);
  assert.equal(taxYearForQuarter(2026.75), 2026);
});
