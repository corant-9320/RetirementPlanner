/**
 * Drawdown optimiser. Pure: builds on simulate() and touches no DOM.
 */

import { simulate } from './simulation.js';

/** A shortfall smaller than half a penny is floating-point noise, not debt. */
const SHORTFALL_TOLERANCE = -0.005;

/** Search resolution: 0.1 percentage point, matching the drawdown input's step. */
const STEPS_PER_PERCENT = 10;
const MAX_PERCENT = 100;

/** First quarter whose closing savings balance is negative, or null if none. */
export function firstShortfall(results) {
  const hit = results.find(result => result.savingsEnd < SHORTFALL_TOLERANCE);
  return hit ? hit.fq : null;
}

/**
 * Find the lowest annual rate (to 0.1%) for one drawdown line at which savings
 * never go negative over the projection. Every other parameter, including the
 * line's start date and the other lines' rates, is held fixed.
 *
 * The rates are scanned upwards rather than bisected. A higher rate empties the
 * pension sooner and can push income into higher tax bands, so a higher rate
 * does not always leave more savings later on, and the set of rates that work
 * need not be one continuous range.
 *
 * @param {object} p - Validated simulation parameters
 * @param {number} startFY - Starting fractional year
 * @param {number} [index=0] - Index of the line in p.drawdowns to optimise
 * @returns {{ok:true, percent:number, drawdown:number}
 *   | {ok:false, reason:'before-drawdown', shortfallFQ:number}
 *   | {ok:false, reason:'no-effect', shortfallFQ:number}
 *   | {ok:false, reason:'none', bestPercent:number, shortfallFQ:number}}
 */
export function findMinimumDrawdown(p, startFY, index = 0) {
  const lines = p.drawdowns || [];
  const target = lines[index];
  if (!target) throw new RangeError(`No drawdown line at index ${index}`);

  const run = percent => simulate({
    ...p,
    drawdowns: lines.map((line, i) => (i === index ? { ...line, rate: percent / 100 } : { ...line })),
  }, startFY);

  const baseline = firstShortfall(run(0));
  if (baseline === null) return { ok: true, percent: 0, drawdown: 0 };

  // Quarters before this line starts are identical at every rate.
  if (baseline < target.startFY) {
    return { ok: false, reason: 'before-drawdown', shortfallFQ: baseline };
  }
  // With no pot, the rate changes nothing.
  if (!(p.pension > 0)) {
    return { ok: false, reason: 'no-effect', shortfallFQ: baseline };
  }

  let bestPercent = 0;
  let bestShortfall = baseline;
  for (let step = 1; step <= MAX_PERCENT * STEPS_PER_PERCENT; step++) {
    // step / 10 parses to the same double as the one-decimal text written back
    // to the form, so the form reproduces exactly the run tested here.
    const percent = step / STEPS_PER_PERCENT;
    const shortfall = firstShortfall(run(percent));
    if (shortfall === null) return { ok: true, percent, drawdown: percent / 100 };
    if (shortfall > bestShortfall) {
      bestShortfall = shortfall;
      bestPercent = percent;
    }
  }
  return { ok: false, reason: 'none', bestPercent, shortfallFQ: bestShortfall };
}
