/**
 * Pure simulation engine. Takes parameters + start time, returns quarterly results.
 * No DOM access — fully testable in isolation.
 */

import { calcTaxHousehold, proRataBands, quarterlyRate } from './utils.js';

/** Zeroed cumulative tax result, used as the opening position of a tax year. */
export function zeroTax() {
  const person = () => ({
    tax: 0,
    taxable: 0,
    psaUsed: 0,
    bands: { basic: 0, higher: 0, additional: 0 },
  });
  return {
    total: 0,
    taxableAnnual: 0,
    psaUsed: 0,
    bands: { basic: 0, higher: 0, additional: 0 },
    p1: person(),
    p2: person(),
  };
}

/** Quarterly state-pension payment, uprated annually from its start value. */
export function statePensionForQuarter(atStart, startDate, fq, annualIncrease) {
  if (fq < startDate || atStart === 0) return 0;
  return (atStart * Math.pow(1 + annualIncrease, fq - startDate)) / 4;
}

/** Sum cloned one-off events occurring in a quarter, converting EUR to GBP. */
export function eventsForQuarter(events, fq, eurGbp) {
  return events
    .filter(event => Math.abs(event.fractYear - fq) < 0.01)
    .reduce((sum, event) => sum + (event.currency === 'EUR' ? event.amount * eurGbp : event.amount), 0);
}

/** UK tax year containing a calendar quarter (January–March belongs to the prior year). */
export function taxYearForQuarter(fq) {
  const quarter = Math.round((fq - Math.floor(fq)) * 4);
  return quarter === 0 ? Math.floor(fq) - 1 : Math.floor(fq);
}

/**
 * Sort drawdown lines by start date into a detached schedule. Each line's rate
 * applies from its start quarter until the next line starts.
 */
export function drawdownSchedule(drawdowns) {
  return (drawdowns || [])
    .map(line => ({ startFY: line.startFY, rate: line.rate }))
    .sort((a, b) => a.startFY - b.startFY);
}

/** Annual drawdown rate in force in a quarter: the latest line started on or before it, else 0. */
export function drawdownRateAt(schedule, fq) {
  let rate = 0;
  for (const line of schedule) {
    if (line.startFY > fq + 1e-9) break;
    rate = line.rate;
  }
  return rate;
}

/** Movement between two cumulative per-person tax positions. */
export function taxPersonDelta(now, was) {
  return {
    taxable: now.taxable - was.taxable,
    tax: now.tax - was.tax,
    psaUsed: now.psaUsed - was.psaUsed,
    basic: now.bands.basic - was.bands.basic,
    higher: now.bands.higher - was.bands.higher,
    additional: now.bands.additional - was.bands.additional,
  };
}

/**
 * Run the retirement simulation.
 * @param {object} p - Parameters from readParams()
 * @param {number} startFY - Starting fractional year (e.g. 2026.5)
 * @returns {Array} Quarterly result objects
 */
export function simulate(p, startFY) {
  const endFY = p.endFY == null ? 2050.75 : p.endFY;
  if (!Number.isFinite(startFY) || !Number.isFinite(endFY) || startFY > endFY) return [];

  // Work with a private snapshot so callers may safely edit their event list
  // while a simulation result is being produced.
  const events = (p.events || []).map(event => ({ ...event }));
  const schedule = drawdownSchedule(p.drawdowns);
  const retireFY = startFY + p.monthsWork / 12;

  let savingsBal = p.savings;
  let pensionBal = p.pension;
  let mortgageLeft = p.mortgageRem;
  let houseVal = p.houseValue;
  // Property transitions are one-shot events driven by "first quarter at or
  // after the target date", so a date that is in the past or off a quarter
  // boundary still fires instead of being skipped.
  let saleDone = false;
  let purchaseDone = false;
  const results = [];

  // True quarterly equivalents of the annual rates, so that four quarters of
  // compounding reproduce exactly the annual rate that was entered.
  const qSavings = quarterlyRate(p.savingsRate);
  const qBorrow = quarterlyRate(p.borrowRate != null ? p.borrowRate : p.savingsRate);
  const qPension = quarterlyRate(p.pensionRate);
  const qHouse = quarterlyRate(p.houseGrowth);

  // Cumulative tax-year accumulator. Tax is charged on a running total for the
  // UK tax year (April–March) rather than by annualising each quarter in
  // isolation, so a single personal allowance and one set of bands apply to the
  // year's actual income. `n` counts the quarters accumulated so far.
  let ty = null;

  // State pension amounts compounded to their start dates
  const spUserAtStart = p.spUser * Math.pow(1 + p.spIncrease, p.spUserFY - startFY);
  const spUser2AtStart = p.spUser2 * Math.pow(1 + p.spIncrease, p.spUser2FY - startFY);
  const spSpouseAtStart = p.spSpouse * Math.pow(1 + p.spIncrease, p.spSpouseFY - startFY);

  for (let fq = startFY; fq <= endFY + 0.001; fq += 0.25) {
    fq = Math.round(fq * 4) / 4; // avoid floating-point drift

    const pensionStart = pensionBal;

    // Pension growth + drawdown (quarterly), both on the opening balance, so
    // pensionEnd === pensionStart + pensionGrowth − pensionDrawn.
    const pensionGrowth = pensionBal * qPension;
    const pensionDrawn = pensionBal * (drawdownRateAt(schedule, fq) / 4);
    pensionBal = pensionBal + pensionGrowth - pensionDrawn;

    // Salary (pro-rated in the retirement quarter)
    let salaryIncome = 0;
    if (fq < retireFY) {
      const qEnd = fq + 0.25;
      const workEnd = Math.min(retireFY, qEnd);
      const fraction = (workEnd - fq) / 0.25;
      salaryIncome = (p.salary / 4) * fraction;
    }

    // State pensions — tracked separately so they can be attributed to the
    // correct taxpayer. spOwner = You (1) + You (2), spSpouse = Spouse.
    const spOwnerIncome =
      statePensionForQuarter(spUserAtStart, p.spUserFY, fq, p.spIncrease) +
      statePensionForQuarter(spUser2AtStart, p.spUser2FY, fq, p.spIncrease);
    const spSpouseIncome = statePensionForQuarter(spSpouseAtStart, p.spSpouseFY, fq, p.spIncrease);
    const statePensionIncome = spOwnerIncome + spSpouseIncome;

    // Interest on the opening balance. A negative balance is borrowing, so it
    // accrues at the (higher) borrowing rate rather than the savings rate —
    // otherwise running out of money looks far cheaper than it is.
    const savingsInterest = savingsBal * (savingsBal < 0 ? qBorrow : qSavings);

    // One-off events in this quarter
    const oneOff = eventsForQuarter(events, fq, p.eurGbp);

    // Is the property sold in this quarter? Also clears a residual mortgage
    // when the house value is zero.
    const sellingNow =
      !saleDone && fq >= p.houseSaleFY && (houseVal > 0 || mortgageLeft > 0);

    // House value appreciation (quarterly, for as long as a property is held —
    // including a replacement bought after the sale). Skipped in the quarter of
    // the sale itself, which is treated as happening at the start of it.
    if (houseVal > 0 && !sellingNow) {
      houseVal = houseVal * (1 + qHouse);
    }

    // House sale — net equity transferred to savings. Negative equity is a real
    // cash cost, so it is not floored at zero.
    let houseSaleEquity = 0;
    if (sellingNow) {
      houseSaleEquity = houseVal - mortgageLeft;
      houseVal = 0;
      mortgageLeft = 0;
      saleDone = true;
    }

    // Mortgage payments — interest portion is the excess of the payment over
    // the capital repayment, and the final payment covers only the capital
    // that is actually left plus that quarter's interest.
    let mortgage = 0;
    if (mortgageLeft > 0 && !saleDone) {
      const qCapital = Math.min(mortgageLeft, p.mortgageCapital / 4);
      const qInterest = Math.max(0, p.mortgagePay / 4 - p.mortgageCapital / 4);
      mortgage = qCapital + qInterest;
      mortgageLeft = Math.max(0, mortgageLeft - qCapital);
    }

    // House purchase lump sum
    let housePurchase = 0;
    if (!purchaseDone && p.housePurchasePrice > 0 && fq >= p.housePurchaseFY) {
      housePurchase = p.housePurchasePrice;
      houseVal += p.housePurchasePrice;
      purchaseDone = true;
    }

    // Rent between selling and buying again (indefinitely if no purchase is
    // planned, since there is nothing to move back into).
    let rent = 0;
    if (p.rentMonthly > 0 && saleDone && !purchaseDone) {
      rent = p.rentMonthly * 3;
    }

    // ── Income tax (cumulative, UK tax-year basis) ──────────────────────────
    // Income is accumulated across the tax year (April–March) and tax is
    // recomputed on the running total against pro-rata allowances and bands.
    // The charge for this quarter is the increase over what has already been
    // charged in the same tax year — the PAYE cumulative method. This means one
    // personal allowance per person per year, applied to the year's real income
    // instead of annualising each quarter separately.
    //
    // Attribution: private pension drawdown and the owner's state pensions to
    // person 1, spouse's state pension to person 2, savings interest split.
    const taxablePensionDrawn = pensionDrawn * (1 - p.pensionTaxFree);
    const pensionIncome = statePensionIncome + taxablePensionDrawn;

    // UK tax year runs April–March: Q1 (Jan–Mar) belongs to the year before.
    const tyKey = taxYearForQuarter(fq);
    if (!ty || ty.key !== tyKey) {
      ty = { key: tyKey, n: 0, priv: 0, spOwn: 0, spSp: 0, sav: 0, prev: zeroTax() };
    }
    ty.n += 1;
    ty.priv += taxablePensionDrawn;
    ty.spOwn += spOwnerIncome;
    ty.spSp += spSpouseIncome;
    ty.sav += Math.max(0, savingsInterest);

    const cum = calcTaxHousehold(
      ty.priv,
      ty.spOwn,
      ty.spSp,
      ty.sav,
      proRataBands(p.taxBands, ty.n / 4),
      p.taxPayers,
    );
    const prev = ty.prev;

    // This quarter's charge is the movement in the cumulative position. It can
    // be negative when earlier quarters over-collected, exactly as a PAYE refund.
    const tax = cum.total - prev.total;
    const taxableIncome = cum.taxableAnnual - prev.taxableAnnual;
    const taxPsaUsed = cum.psaUsed - prev.psaUsed;
    const taxBasic = cum.bands.basic - prev.bands.basic;
    const taxHigher = cum.bands.higher - prev.bands.higher;
    const taxAdditional = cum.bands.additional - prev.bands.additional;
    const taxPensionIncome = pensionIncome;
    const taxSavingsInterest = Math.max(0, savingsInterest);

    // Per-person movement (for the tax tooltip)
    const taxP1 = taxPersonDelta(cum.p1, prev.p1);
    const taxP2 = p.taxPayers >= 2 ? taxPersonDelta(cum.p2, prev.p2) : null;

    ty.prev = cum;

    const targetSpend = p.targetSpend / 4;
    // House sale equity is part of total income so that the reported figures
    // reconcile: savings movement === totalIncome − totalOutgoings.
    const totalIncome =
      salaryIncome + pensionDrawn + statePensionIncome + savingsInterest + oneOff + houseSaleEquity;
    const totalOutgoings = targetSpend + mortgage + rent + housePurchase + tax;

    savingsBal = savingsBal + totalIncome - totalOutgoings;

    results.push({
      fq,
      year: Math.floor(fq),
      quarter: Math.round((fq - Math.floor(fq)) * 4),
      salaryIncome,
      pensionGrowth,
      pensionDrawn,
      statePensionIncome,
      spOwnerIncome,
      spSpouseIncome,
      savingsInterest,
      oneOff,
      houseSale: houseSaleEquity,
      totalIncome,
      mortgage,
      rent,
      housePurchase,
      targetSpend,
      taxableIncome,
      tax,
      taxPensionIncome,
      taxSavingsInterest,
      taxPsaUsed,
      taxBasic,
      taxHigher,
      taxAdditional,
      taxP1,
      taxP2,
      totalOutgoings,
      pensionStart,
      pensionEnd: pensionBal,
      savingsEnd: savingsBal,
      houseVal,
      mortgageLeft,
    });
  }
  return results;
}
