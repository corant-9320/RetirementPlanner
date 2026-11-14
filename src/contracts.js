/**
 * Shared domain contracts. This module intentionally has no runtime exports;
 * import its typedefs with `@typedef {import('./contracts.js').Name} Name`.
 */

/** @typedef {'GBP'|'EUR'} Currency */
/** @typedef {{fractYear:number, amount:number, description:string, currency:Currency}} Event */
/** @typedef {{startFY:number, rate:number}} DrawdownLine - Domain drawdown line: quarter-aligned start and annual decimal rate. */
/** @typedef {{year:string, quarter:string, rate:string}} DrawdownSnapshot - Raw UI values of one drawdown line. */
/** @typedef {{personalAllowance:number, basicLimit:number, higherLimit:number, basicRate:number, higherRate:number, additionalRate:number, savingsStartBand?:number, psaBasic?:number, psaHigher?:number}} TaxBands */
/** @typedef {{tax:number, taxable:number, psaUsed:number, bands:{basic:number,higher:number,additional:number}}} TaxPersonResult */
/** @typedef {{taxable:number,tax:number,psaUsed:number,basic:number,higher:number,additional:number}} TaxPersonDelta */
/**
 * Inputs to the quarterly retirement model. Rates are decimal annual rates and
 * all monetary values are GBP unless an Event explicitly identifies EUR.
 * @typedef {Object} SimulationParams
 * @property {number} eurGbp
 * @property {number} salary
 * @property {number} monthsWork
 * @property {number} savings
 * @property {number} savingsRate
 * @property {number} [borrowRate]
 * @property {number} pension
 * @property {number} pensionRate
 * @property {DrawdownLine[]} drawdowns - Rate schedule; each line applies from its start until the next line starts. No drawdown before the earliest line.
 * @property {number} spUser
 * @property {number} spUserFY
 * @property {number} spUser2
 * @property {number} spUser2FY
 * @property {number} spSpouse
 * @property {number} spSpouseFY
 * @property {number} spIncrease
 * @property {number} houseValue
 * @property {number} houseGrowth
 * @property {number} mortgageRem
 * @property {number} mortgagePay
 * @property {number} mortgageCapital
 * @property {number} houseSaleFY
 * @property {number} rentMonthly
 * @property {number} housePurchaseFY
 * @property {number} housePurchasePrice
 * @property {number} targetSpend
 * @property {1|2} taxPayers
 * @property {number} pensionTaxFree
 * @property {TaxBands} taxBands
 * @property {Event[]} events
 * @property {number} [endFY]
 */
/** @typedef {{fq:number,year:number,quarter:number,salaryIncome:number,pensionGrowth:number,pensionDrawn:number,statePensionIncome:number,spOwnerIncome:number,spSpouseIncome:number,savingsInterest:number,oneOff:number,houseSale:number,totalIncome:number,mortgage:number,rent:number,housePurchase:number,targetSpend:number,taxableIncome:number,tax:number,taxPensionIncome:number,taxSavingsInterest:number,taxPsaUsed:number,taxBasic:number,taxHigher:number,taxAdditional:number,taxP1:TaxPersonDelta,taxP2:TaxPersonDelta|null,totalOutgoings:number,pensionStart:number,pensionEnd:number,savingsEnd:number,houseVal:number,mortgageLeft:number}} QuarterResult */
/** @typedef {{year:number,quarters:QuarterResult[],salaryIncome:number,pensionGrowth:number,pensionDrawn:number,statePensionIncome:number,savingsInterest:number,oneOff:number,houseSale:number,totalIncome:number,mortgage:number,rent:number,housePurchase:number,targetSpend:number,taxableIncome:number,tax:number,taxPensionIncome:number,taxSavingsInterest:number,taxPsaUsed:number,taxBasic:number,taxHigher:number,taxAdditional:number,taxP1:TaxPersonDelta|null,taxP2:TaxPersonDelta|null,totalOutgoings:number,pensionStart:number,pensionEnd:number,savingsEnd:number}} AnnualResult */
/** @typedef {{fieldCurrency:Record<string,Currency>,rawValues:Record<string,string>,plainValues:Record<string,string>,selectValues:Record<string,string>,events:Event[],drawdowns:DrawdownSnapshot[]}} FormSnapshot */
/** @typedef {FormSnapshot & {savedAt:string}} StoredScenario */

export {};
