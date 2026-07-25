/**
 * Shared utility functions: money parsing/formatting, currency helpers.
 */

/** Parse a comma-formatted money string into a number. */
export function parseMoney(str) {
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

/** Format a number as a comma-separated integer string (en-GB locale). */
export function formatMoney(n) {
  if (n === '' || isNaN(Number(n))) return '';
  return Math.round(Number(n)).toLocaleString('en-GB');
}

/** Format a value as GBP with sign handling (uses minus sign character). */
export function gbp(v) {
  return (v < 0 ? '\u2212' : '') + '\u00A3' + Math.abs(Math.round(v)).toLocaleString('en-GB');
}

/** Wrap a GBP value in a coloured span if negative. */
export function cell(v) {
  return v < 0 ? `<span class="neg">${gbp(v)}</span>` : gbp(v);
}

/**
 * Get the current fractional year (e.g. 2026.5 = Q3 2026).
 * Exported so simulation can receive it as a parameter for testability,
 * but also callable for default values.
 */
export function currentFractYear() {
  const now = new Date();
  const yr = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3);
  return yr + q * 0.25;
}

/**
 * Convert an annual rate into the equivalent quarterly compounding rate.
 *
 * Using r/4 overstates the outcome, because compounding it four times yields
 * (1 + r/4)^4 − 1 > r (3.0% becomes 3.034%). This returns the rate that
 * compounds to exactly r over four quarters, matching the true annual
 * compounding already used for state pension uprating.
 */
export function quarterlyRate(annualRate) {
  if (annualRate <= -1) return -1;
  return Math.pow(1 + annualRate, 0.25) - 1;
}

/** Format a fractional year as "2041 Q2". */
export function fmtYQ(frac) {
  const yr = Math.floor(frac);
  const qi = Math.round((frac - yr) * 4);
  return `${yr} Q${qi + 1}`;
}

/**
 * Scale the allowances and band thresholds to a fraction of a tax year.
 *
 * Used for cumulative (PAYE-style) tax: after n quarters of a tax year, tax is
 * charged on cumulative income against n/4 of the annual allowance and band
 * limits. Rates are unchanged. At n = 4 this returns the full annual bands, so
 * the total charged over a complete tax year equals the correct annual bill.
 *
 * @param {object} bands - Annual band parameters.
 * @param {number} fraction - Portion of the tax year elapsed (0–1).
 */
export function proRataBands(bands, fraction) {
  const f = Math.min(1, Math.max(0, fraction));
  return {
    ...bands,
    personalAllowance: bands.personalAllowance * f,
    basicLimit: bands.basicLimit * f,
    higherLimit: bands.higherLimit * f,
    psaBasic: (bands.psaBasic != null ? bands.psaBasic : 1000) * f,
    psaHigher: (bands.psaHigher != null ? bands.psaHigher : 500) * f,
    savingsStartBand: (bands.savingsStartBand != null ? bands.savingsStartBand : 5000) * f,
  };
}

/**
 * Estimate UK income tax for a single person.
 *
 * Savings interest is stacked on top of non-savings income and relieved by the
 * starting rate for savings and the Personal Savings Allowance before any tax
 * is charged. The personal-allowance taper above £100k is not modelled.
 *
 * @param {number} nonSavings - Annual non-savings income (state pension + taxable private drawdown).
 * @param {number} savings    - Annual savings interest.
 * @param {object} bands      - Tax band parameters.
 * @returns {{ tax:number, taxable:number, psaUsed:number, bands:{basic,higher,additional} }}
 */
export function calcTaxPerson(nonSavings, savings, bands) {
  const nonSav = Math.max(0, nonSavings);
  const sav = Math.max(0, savings);
  const { personalAllowance: pa, basicLimit, higherLimit, basicRate, higherRate, additionalRate } = bands;
  const psaBasic = bands.psaBasic != null ? bands.psaBasic : 1000;
  const psaHigher = bands.psaHigher != null ? bands.psaHigher : 500;

  // PSA threshold is determined by where total income lands.
  const provisional = nonSav + sav;
  let psa;
  if (provisional <= basicLimit) psa = psaBasic;
  else if (provisional <= higherLimit) psa = psaHigher;
  else psa = 0;

  // Starting rate for savings: a 0% band (£5,000) available to savings income,
  // reduced £-for-£ by any non-savings income above the personal allowance. It
  // is fully withdrawn once non-savings income exceeds PA + the band.
  const srBand = bands.savingsStartBand != null ? bands.savingsStartBand : 5000;
  const startRateAvailable = Math.max(0, srBand - Math.max(0, nonSav - pa));

  // Both the starting-rate band and the PSA relieve savings income at 0%.
  const savingsRelief = startRateAvailable + psa;
  const taxableSavings = Math.max(0, sav - savingsRelief);
  const taxable = nonSav + taxableSavings;

  let basic = 0, higher = 0, additional = 0;
  if (taxable > pa) {
    basic = (Math.min(taxable, basicLimit) - pa) * basicRate;
  }
  if (taxable > basicLimit) {
    higher = (Math.min(taxable, higherLimit) - basicLimit) * higherRate;
  }
  if (taxable > higherLimit) {
    additional = (taxable - higherLimit) * additionalRate;
  }

  return {
    tax: basic + higher + additional,
    taxable,
    // Combined 0% relief actually used against savings interest
    // (starting-rate band + Personal Savings Allowance).
    psaUsed: Math.min(sav, savingsRelief),
    bands: { basic, higher, additional },
  };
}

/**
 * Estimate UK income tax for a household, routing income to the correct person.
 *
 * Income attribution:
 *   Person 1 (older partner / pension owner):
 *     - All private pension drawdown
 *     - State pension — You (1) and You (2)  [spOwner portion]
 *   Person 2 (spouse, only present when taxPayers === 2):
 *     - State pension — Spouse  [spSpouse portion]
 *   Savings interest is split equally between both taxpayers (shared savings).
 *
 * @param {number} privatePensionAnnual  - Taxable private drawdown for the year (already net of tax-free %).
 * @param {number} spOwnerAnnual         - State pension for person 1 (You 1 + You 2).
 * @param {number} spSpouseAnnual        - State pension for person 2 (Spouse).
 * @param {number} savingsAnnual         - Savings interest (shared, split evenly).
 * @param {object} bands                 - Tax band parameters.
 * @param {number} [taxPayers=1]         - 1 or 2.
 * @returns {{ total, taxableAnnual, psaUsed, bands:{basic,higher,additional},
 *             p1:{tax,taxable,psaUsed,bands}, p2:{tax,taxable,psaUsed,bands} }}
 */
export function calcTaxHousehold(privatePensionAnnual, spOwnerAnnual, spSpouseAnnual, savingsAnnual, bands, taxPayers = 1) {
  const n = taxPayers >= 2 ? 2 : 1;
  const savEach = Math.max(0, savingsAnnual) / n;

  // Person 1: all private pension + owner's state pensions + half savings interest
  const p1 = calcTaxPerson(privatePensionAnnual + spOwnerAnnual, savEach, bands);

  // Person 2: spouse's state pension + half savings interest (or zero if single)
  const p2 = n === 2
    ? calcTaxPerson(spSpouseAnnual, savEach, bands)
    : { tax: 0, taxable: 0, psaUsed: 0, bands: { basic: 0, higher: 0, additional: 0 } };

  return {
    total: p1.tax + p2.tax,
    taxableAnnual: p1.taxable + p2.taxable,
    psaUsed: p1.psaUsed + p2.psaUsed,
    bands: {
      basic: p1.bands.basic + p2.bands.basic,
      higher: p1.bands.higher + p2.bands.higher,
      additional: p1.bands.additional + p2.bands.additional,
    },
    p1,
    p2,
  };
}

/**
 * @deprecated Use calcTaxHousehold instead.
 * Kept for any external callers; routes to the new function treating all
 * non-savings income as belonging to a single owner.
 */
export function calcTax(nonSavingsAnnual, savingsAnnual, bands, taxpayers = 1) {
  return calcTaxHousehold(nonSavingsAnnual, 0, 0, savingsAnnual, bands, taxpayers);
}
