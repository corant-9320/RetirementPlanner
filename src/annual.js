/** @typedef {import('./contracts.js').QuarterResult} QuarterResult */
/** @typedef {import('./contracts.js').AnnualResult} AnnualResult */

const SUM_FIELDS = [
  'salaryIncome', 'pensionDrawn', 'statePensionIncome', 'savingsInterest',
  'oneOff', 'houseSale', 'totalIncome', 'mortgage', 'rent', 'housePurchase',
  'targetSpend', 'taxableIncome', 'tax', 'taxPensionIncome',
  'taxSavingsInterest', 'taxPsaUsed', 'taxBasic', 'taxHigher',
  'taxAdditional', 'totalOutgoings',
];

function aggregatePerson(quarters, key) {
  const values = quarters.map(quarter => quarter[key]).filter(Boolean);
  if (values.length === 0) return null;
  return {
    taxable: values.reduce((sum, value) => sum + value.taxable, 0),
    tax: values.reduce((sum, value) => sum + value.tax, 0),
    psaUsed: values.reduce((sum, value) => sum + value.psaUsed, 0),
    basic: values.reduce((sum, value) => sum + value.basic, 0),
    higher: values.reduce((sum, value) => sum + value.higher, 0),
    additional: values.reduce((sum, value) => sum + value.additional, 0),
  };
}

/**
 * Group quarterly results into calendar years, summing flows and carrying the
 * first opening and final closing balances. Input results are not modified.
 * @param {QuarterResult[]} results
 * @returns {AnnualResult[]}
 */
export function aggregateAnnual(results) {
  const grouped = new Map();
  for (const result of results) {
    const quarters = grouped.get(result.year) || [];
    quarters.push(result);
    grouped.set(result.year, quarters);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, quarters]) => {
      const annual = { year, quarters: quarters.slice() };
      for (const field of SUM_FIELDS) {
        annual[field] = quarters.reduce((sum, quarter) => sum + quarter[field], 0);
      }
      annual.taxP1 = aggregatePerson(quarters, 'taxP1');
      annual.taxP2 = aggregatePerson(quarters, 'taxP2');
      annual.pensionStart = quarters[0].pensionStart;
      annual.pensionEnd = quarters[quarters.length - 1].pensionEnd;
      annual.savingsEnd = quarters[quarters.length - 1].savingsEnd;
      return annual;
    });
}
