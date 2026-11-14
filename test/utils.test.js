import test from 'node:test';
import assert from 'node:assert/strict';
import { calcTaxHousehold, calcTaxPerson, proRataBands, quarterlyRate } from '../src/utils.js';

const bands = {
  personalAllowance: 12570,
  basicLimit: 50270,
  higherLimit: 125140,
  basicRate: 0.2,
  higherRate: 0.4,
  additionalRate: 0.45,
  savingsStartBand: 5000,
};

test('quarterlyRate compounds to the entered annual rate', () => {
  const quarterly = quarterlyRate(0.08);
  assert.ok(Math.abs((1 + quarterly) ** 4 - 1.08) < 1e-12);
  assert.equal(quarterlyRate(-1), -1);
});

test('proRataBands scales thresholds but not rates', () => {
  const half = proRataBands(bands, 0.5);
  assert.equal(half.personalAllowance, 6285);
  assert.equal(half.basicLimit, 25135);
  assert.equal(half.basicRate, 0.2);
});

test('tax calculation applies allowance, bands, and savings relief', () => {
  const result = calcTaxPerson(30000, 2000, bands);
  assert.equal(result.psaUsed, 1000);
  assert.equal(result.taxable, 31000);
  assert.equal(result.tax, (31000 - 12570) * 0.2);
});

test('household tax attributes income and splits savings between two people', () => {
  const result = calcTaxHousehold(20000, 10000, 15000, 2000, bands, 2);
  assert.equal(result.p1.taxable, 30000);
  assert.equal(result.p2.taxable, 15000);
  assert.equal(result.total, result.p1.tax + result.p2.tax);
});
