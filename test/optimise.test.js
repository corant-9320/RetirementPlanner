import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/simulation.js';
import { findMinimumDrawdown, firstShortfall } from '../src/optimise.js';

function params(overrides = {}) {
  return {
    eurGbp: 0.8, salary: 0, monthsWork: 0, savings: 0, savingsRate: 0,
    borrowRate: 0, pension: 0, pensionRate: 0,
    drawdowns: [{ startFY: 2026, rate: 0 }], spUser: 0, spUserFY: 2100, spUser2: 0,
    spUser2FY: 2100, spSpouse: 0, spSpouseFY: 2100, spIncrease: 0,
    houseValue: 0, houseGrowth: 0, mortgageRem: 0, mortgagePay: 0,
    mortgageCapital: 0, houseSaleFY: 2100, rentMonthly: 0,
    housePurchaseFY: 2100, housePurchasePrice: 0, targetSpend: 0,
    taxPayers: 1, pensionTaxFree: 0,
    taxBands: { personalAllowance: 12570, basicLimit: 50270, higherLimit: 125140,
      basicRate: 0.2, higherRate: 0.4, additionalRate: 0.45, savingsStartBand: 5000 },
    events: [], endFY: 2035.75, ...overrides,
  };
}

const withRate = (p, percent, index = 0) => ({
  ...p,
  drawdowns: p.drawdowns.map((line, i) => (i === index ? { ...line, rate: percent / 100 } : line)),
});
const shortfallAt = (p, percent, index = 0) => firstShortfall(simulate(withRate(p, percent, index), 2026));

test('finds the lowest 0.1% rate that keeps savings non-negative', () => {
  const p = params({ pension: 300000, pensionRate: 0.03, savings: 5000,
    savingsRate: 0.02, targetSpend: 18000 });
  const result = findMinimumDrawdown(p, 2026);
  assert.equal(result.ok, true);
  assert.ok(result.percent > 0 && result.percent < 100);
  assert.equal(shortfallAt(p, result.percent), null);
  assert.notEqual(shortfallAt(p, (Math.round(result.percent * 10) - 1) / 10), null);
  assert.equal(result.drawdown, result.percent / 100);
});

test('the reported rate survives the round trip through one-decimal form text', () => {
  const p = params({ pension: 250000, savings: 0, targetSpend: 15000, pensionTaxFree: 0.25 });
  const result = findMinimumDrawdown(p, 2026);
  assert.equal(result.ok, true);
  const fromForm = Number(result.percent.toFixed(1)) / 100;
  assert.equal(fromForm, result.drawdown);
});

test('returns zero when savings never go negative without drawdown', () => {
  const result = findMinimumDrawdown(params({ pension: 100000, savings: 1e6, targetSpend: 20000 }), 2026);
  assert.deepEqual(result, { ok: true, percent: 0, drawdown: 0 });
});

test('reports a shortfall before the line starts as unfixable', () => {
  const result = findMinimumDrawdown(params({ pension: 1e6, savings: 10000,
    targetSpend: 20000, drawdowns: [{ startFY: 2030, rate: 0 }] }), 2026);
  assert.deepEqual(result, { ok: false, reason: 'before-drawdown', shortfallFQ: 2026.5 });
});

test('reports that the rate has no effect without a pension pot', () => {
  const result = findMinimumDrawdown(params({ savings: 0, targetSpend: 4000 }), 2026);
  assert.deepEqual(result, { ok: false, reason: 'no-effect', shortfallFQ: 2026 });
});

test('reports the longest-lasting rate when none is enough', () => {
  const p = params({ pension: 20000, savings: 0, targetSpend: 8000 });
  const result = findMinimumDrawdown(p, 2026);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'none');
  assert.equal(shortfallAt(p, result.bestPercent), result.shortfallFQ);
  for (const percent of [0, 10, 50, 100]) {
    assert.ok(shortfallAt(p, percent) <= result.shortfallFQ);
  }
});

test('optimises only the chosen line and holds the other lines fixed', () => {
  const p = params({ pension: 400000, pensionRate: 0.03, savings: 20000, targetSpend: 20000,
    drawdowns: [{ startFY: 2026, rate: 0.05 }, { startFY: 2029, rate: 0 }] });
  const result = findMinimumDrawdown(p, 2026, 1);
  assert.equal(result.ok, true);
  assert.ok(result.percent > 0);
  assert.equal(shortfallAt(p, result.percent, 1), null);
  assert.notEqual(shortfallAt(p, (Math.round(result.percent * 10) - 1) / 10, 1), null);
  assert.throws(() => findMinimumDrawdown(p, 2026, 2), RangeError);
});

test('does not mutate the caller\'s parameters', () => {
  const p = params({ pension: 300000, targetSpend: 18000,
    drawdowns: [{ startFY: 2026, rate: 0.05 }, { startFY: 2030, rate: 0.03 }] });
  const snapshot = structuredClone(p);
  findMinimumDrawdown(p, 2026, 1);
  assert.deepEqual(p, snapshot);
});
