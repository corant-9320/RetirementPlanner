# Retirement Planner — Current Requirements

## Purpose and scope

The application is a client-side retirement cash-flow planner. It produces one deterministic projection from the current calendar quarter through 2050 Q4; it does not currently produce probabilities, stochastic ranges, financial advice, or guarantees. Inputs and outputs are expressed in today's-money terms, so entered growth, return, borrowing, and pension-increase rates are expected to be real (net of inflation).

The browser is the only runtime dependency. There is no backend, login, account sync, IP allowlist, database, or supported scenario export/import workflow.

## Inputs

The planner accepts an EUR→GBP exchange rate; net annual salary and remaining work months; savings, real savings/borrowing rates; private pension balance, real return, drawdown rate/date, and tax-free drawdown percentage; up to three state-pension streams and a real increase rate; property value/growth, mortgage balance/payment/capital repayment, sale timing, rent, and replacement purchase; target living spend; configurable UK tax assumptions; and dated positive or negative one-off events.

Currency-toggle values and EUR events are converted to GBP when parameters are read. The simulation then operates entirely in GBP.

## Deterministic model and timing

- `simulate(params, startFY)` is pure: identical parameters and fractional-year start produce identical quarterly results.
- Annual rates use equivalent quarterly compounding, not annual-rate ÷ 4. Pension drawdown and target spend use annual amount/rate ÷ 4.
- Salary is already net of tax, is paid quarterly, and is prorated in the final working quarter.
- Savings interest is based on the opening balance. Negative savings accrue the configured borrowing rate.
- State-pension input amounts are uprated from the projection start to their start dates and thereafter; payments begin in the selected quarter.
- One-off events occur only in their exact selected quarter. Property sale and purchase are one-shot events in the first simulated quarter at or after their dates.
- A sale occurs at the start of its quarter, transfers house value less remaining mortgage (including negative equity) to savings, and skips that quarter's house growth. A purchase is paid from savings and added to property value. Rent runs after sale until purchase, or indefinitely when no purchase is planned.
- Mortgage outflow is capital repayment plus the implied interest portion of the configured payment; there is no separate mortgage-rate/amortisation model.
- Quarterly cash reconciliation is `ending savings = opening savings + total income − total outgoings`. House-sale equity is income; living spend, mortgage, rent, purchase, and tax are outgoings.

## Tax assumptions

Tax is an estimate using user-entered UK thresholds/rates, not an automatically updated tax-law service. It is recalculated cumulatively over simulated quarters of each April–March tax year; each quarter records the change in cumulative liability and can therefore contain a refund. Calendar-year table rows can span two tax years and need not equal a standalone annual tax calculation.

Net salary, one-off events, property proceeds, and savings principal are not taxed. The taxable private-pension fraction and the owner's state pensions belong to person 1; the spouse state pension belongs to person 2 when two taxpayers are selected; positive savings interest is split equally. Savings starting-rate relief and the Personal Savings Allowance are modelled. National Insurance, dividends, capital gains, personal-allowance taper above £100,000, and other reliefs are not modelled.

## Outputs and interaction

The result is a quarterly series rendered as calendar-year summaries expandable to quarters, a reorderable table, negative-savings warnings, and a stacked savings/pension/housing-equity chart. Annual income/outgoing/tax figures are sums of displayed quarters; annual opening/closing balances come from the first/last available quarter.

The "Find lowest" button beside the drawdown rate scans 0–100% in 0.1% steps, holding every other input (including the drawdown start date) fixed, and sets the lowest rate at which savings never close a quarter below zero. A higher rate does not always leave more savings later (the pot empties sooner and income can move into higher bands), so the search is a full upward scan rather than a bisection. Pension left at the end of the projection is not taxed or valued. When no rate works, the planner says whether the shortfall falls before drawdown starts, there is no pot, or even the longest-lasting rate runs out, and leaves the field unchanged. Setting the rate is one undoable step and re-runs the simulation.

Named scenarios and column order persist only in the current browser's `localStorage`. Saving does not sync or transmit data. Undo/redo is in-memory, snapshot-based, capped at 100 steps, and resets on reload.

## Acceptance expectations

- Re-running unchanged inputs at the same supplied start quarter yields deeply equal quarterly results through 2050 Q4.
- Every quarter satisfies cash reconciliation within floating-point tolerance; annual flow fields equal their quarter sums and annual endpoint balances equal the appropriate quarter endpoints.
- Real annual rates compound to the entered annual rate over four quarters; salary retirement-quarter proration and one-shot events/property transitions occur once at documented boundaries.
- Tax tests cover April–March rollover, partial tax years, one/two-person attribution, savings relief, tax-free pension drawdown, and possible cumulative refunds.
- Persistence tests cover malformed storage, complete round trips, legacy-shape migration, and unchanged scenario semantics; history tests cover coalescing, redo invalidation, limits, and restore without recursive recording.
- A production candidate must pass `npm run check`, which executes the complete Node test suite and production build, followed by a browser smoke check.

## Deferred capabilities

Stochastic trials/percentile outcomes and automatic optimisation of sustainable spend remain future work. Preserve deterministic mode as the mechanics baseline when adding either capability.