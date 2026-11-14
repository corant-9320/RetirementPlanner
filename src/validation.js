/** @typedef {import('./contracts.js').SimulationParams} SimulationParams */

const REQUIRED_NUMBERS = [
  'eurGbp', 'salary', 'monthsWork', 'savings', 'savingsRate', 'pension',
  'pensionRate', 'spUser', 'spUserFY',
  'spUser2', 'spUser2FY', 'spSpouse', 'spSpouseFY', 'spIncrease',
  'houseValue', 'houseGrowth', 'mortgageRem', 'mortgagePay',
  'mortgageCapital', 'houseSaleFY', 'rentMonthly', 'housePurchaseFY',
  'housePurchasePrice', 'targetSpend', 'taxPayers', 'pensionTaxFree',
];
const NONNEGATIVE_MONEY = [
  'salary', 'pension', 'spUser', 'spUser2', 'spSpouse', 'houseValue',
  'mortgageRem', 'mortgagePay', 'mortgageCapital', 'rentMonthly',
  'housePurchasePrice', 'targetSpend',
];
const RETURN_RATES = ['savingsRate', 'borrowRate', 'pensionRate', 'spIncrease', 'houseGrowth'];
const QUARTER_DATES = [
  'spUserFY', 'spUser2FY', 'spSpouseFY',
  'houseSaleFY', 'housePurchaseFY', 'endFY',
];
const REQUIRED_TAX_NUMBERS = [
  'personalAllowance', 'basicLimit', 'higherLimit',
  'basicRate', 'higherRate', 'additionalRate',
];
const OPTIONAL_TAX_NUMBERS = ['savingsStartBand', 'psaBasic', 'psaHigher'];

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function quarterAligned(value) {
  return isFiniteNumber(value) && Math.abs(value * 4 - Math.round(value * 4)) < 1e-8;
}

/**
 * Validate a complete simulation input without coercing or mutating it.
 * @param {SimulationParams} params
 * @param {{startFY?:number}} [options]
 * @returns {{field:string,message:string}[]}
 */
export function validateParams(params, { startFY } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    add('params', 'must be an object');
    return errors;
  }

  for (const field of REQUIRED_NUMBERS) {
    if (!isFiniteNumber(params[field])) add(field, 'must be a finite number');
  }
  for (const field of ['borrowRate', 'endFY']) {
    if (params[field] != null && !isFiniteNumber(params[field])) add(field, 'must be a finite number');
  }

  if (isFiniteNumber(params.eurGbp) && params.eurGbp <= 0) add('eurGbp', 'must be greater than zero');
  if (isFiniteNumber(params.monthsWork) && params.monthsWork < 0) add('monthsWork', 'must be nonnegative');
  for (const field of NONNEGATIVE_MONEY) {
    if (isFiniteNumber(params[field]) && params[field] < 0) add(field, 'must be nonnegative');
  }
  for (const field of RETURN_RATES) {
    const value = params[field];
    if (value != null && isFiniteNumber(value) && (value < -1 || value > 1)) {
      add(field, 'must be between -1 and 1');
    }
  }
  if (isFiniteNumber(params.pensionTaxFree) && (params.pensionTaxFree < 0 || params.pensionTaxFree > 1)) {
    add('pensionTaxFree', 'must be between 0 and 1');
  }

  // Drawdown schedule. An empty list is valid and means no drawdown.
  if (!Array.isArray(params.drawdowns)) {
    add('drawdowns', 'must be an array');
  } else {
    const starts = new Map();
    params.drawdowns.forEach((line, index) => {
      const field = `drawdowns[${index}]`;
      if (!line || typeof line !== 'object' || Array.isArray(line)) {
        add(field, 'must be an object');
        return;
      }
      if (!isFiniteNumber(line.startFY)) add(`${field}.startFY`, 'must be a finite number');
      else if (!quarterAligned(line.startFY)) add(`${field}.startFY`, 'must be aligned to a calendar quarter');
      else {
        const key = Math.round(line.startFY * 4);
        if (starts.has(key)) {
          add(`${field}.startFY`, `starts in the same quarter as drawdown line ${starts.get(key) + 1}`);
        } else {
          starts.set(key, index);
        }
      }
      if (!isFiniteNumber(line.rate)) add(`${field}.rate`, 'must be a finite number');
      else if (line.rate < 0 || line.rate > 1) add(`${field}.rate`, 'must be between 0 and 1');
    });
  }
  if (isFiniteNumber(params.taxPayers) && params.taxPayers !== 1 && params.taxPayers !== 2) {
    add('taxPayers', 'must be exactly 1 or 2');
  }
  for (const field of QUARTER_DATES) {
    if (params[field] != null && isFiniteNumber(params[field]) && !quarterAligned(params[field])) {
      add(field, 'must be aligned to a calendar quarter');
    }
  }

  const endFY = params.endFY == null ? 2050.75 : params.endFY;
  if (startFY != null && !isFiniteNumber(startFY)) add('startFY', 'must be a finite number');
  else if (startFY != null && !quarterAligned(startFY)) add('startFY', 'must be aligned to a calendar quarter');
  if (isFiniteNumber(startFY) && isFiniteNumber(endFY) && endFY < startFY) {
    add('endFY', 'must not be before startFY');
  }
  if (isFiniteNumber(params.mortgageCapital) && isFiniteNumber(params.mortgagePay)
      && params.mortgageCapital > params.mortgagePay) {
    add('mortgageCapital', 'must not exceed mortgagePay');
  }

  const bands = params.taxBands;
  if (!bands || typeof bands !== 'object' || Array.isArray(bands)) {
    add('taxBands', 'must be an object');
  } else {
    for (const field of REQUIRED_TAX_NUMBERS) {
      if (!isFiniteNumber(bands[field])) add(`taxBands.${field}`, 'must be a finite number');
    }
    for (const field of OPTIONAL_TAX_NUMBERS) {
      if (bands[field] != null && !isFiniteNumber(bands[field])) {
        add(`taxBands.${field}`, 'must be a finite number');
      }
    }
    for (const field of ['personalAllowance', 'basicLimit', 'higherLimit', ...OPTIONAL_TAX_NUMBERS]) {
      if (isFiniteNumber(bands[field]) && bands[field] < 0) add(`taxBands.${field}`, 'must be nonnegative');
    }
    for (const field of ['basicRate', 'higherRate', 'additionalRate']) {
      if (isFiniteNumber(bands[field]) && (bands[field] < 0 || bands[field] > 1)) {
        add(`taxBands.${field}`, 'must be between 0 and 1');
      }
    }
    if (isFiniteNumber(bands.personalAllowance) && isFiniteNumber(bands.basicLimit)
        && bands.personalAllowance > bands.basicLimit) {
      add('taxBands.basicLimit', 'must be at least personalAllowance');
    }
    if (isFiniteNumber(bands.basicLimit) && isFiniteNumber(bands.higherLimit)
        && bands.basicLimit > bands.higherLimit) {
      add('taxBands.higherLimit', 'must be at least basicLimit');
    }
  }

  if (!Array.isArray(params.events)) {
    add('events', 'must be an array');
  } else {
    params.events.forEach((event, index) => {
      const field = `events[${index}]`;
      if (!event || typeof event !== 'object' || Array.isArray(event)) {
        add(field, 'must be an object');
        return;
      }
      if (!isFiniteNumber(event.fractYear)) add(`${field}.fractYear`, 'must be a finite number');
      else if (!quarterAligned(event.fractYear)) add(`${field}.fractYear`, 'must be aligned to a calendar quarter');
      if (!isFiniteNumber(event.amount)) add(`${field}.amount`, 'must be a finite number');
      if (typeof event.description !== 'string') add(`${field}.description`, 'must be a string');
      if (event.currency !== 'GBP' && event.currency !== 'EUR') {
        add(`${field}.currency`, 'must be GBP or EUR');
      }
    });
  }
  return errors;
}
