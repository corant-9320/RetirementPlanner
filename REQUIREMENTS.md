# Retirement Planner — Functional Requirements

The goal of the retirement planner is to pass in some parameters describing current financial situation and some projections for future changes. The planner will then model a range of future scenarios in order to predict a range of financial outcomes for each year through to 2050. All numbers are in today's terms. This means interest rates need to be entered net of inflation. Some values will be in EUR, others in GBP.

## Input Parameters

- EUR to GBP exchange rate
- Current Net Salary
- Months to continue working
- Current Savings and expected return rate
- Current Private Pensions and expected return rate and drawdown rate
- Current State Pensions amount and start date for user and spouse. Expected increase per year
- Mortgage Remaining
- Mortgage Payments
- Expected House Sale Date and Price
- A number of One Off events - Amount and date
- A minimum threshold for Savings

## Output

- Yearly Expenditure Budget
- End of year Savings

## UI

- Left hand panel collects the Input parameters
- Right hand contains rows per year (expandable to quarters). Columns are Income from Pension and Savings interest, Outgoings, Total Outgoings, Pension Remaining at start of year, Savings Remaining

## Backlog

### 1. Stochastic projection (range of outcomes)

The engine currently produces a single deterministic path from constant real
rates. The stated goal is a *range* of outcomes, which this cannot show. In
particular, sequence-of-returns risk is invisible: a plan averaging 4% real
survives comfortably on a smooth path but can fail if the poor years land early
in drawdown.

Intent:

- Run N trials (~1,000) with the savings and pension return rates drawn per
  period rather than held constant, taking volatility as an input alongside the
  existing mean.
- Report the distribution rather than one line: success rate (savings staying
  above zero to 2050), and percentile bands for savings and net worth.
- Render the percentile bands on the existing chart, with the deterministic run
  overlaid as the central case.
- Keep the deterministic mode available — it stays the right tool for checking
  the mechanics of a scenario.

Notes: the simulation engine is already pure and side-effect free, so trials can
reuse `simulate()` unchanged if the rates become per-quarter inputs. House growth
is probably best left deterministic given the property is a lumpy single asset.

### 2. Auto-optimise target spend

Target annual expenditure is currently an input, so finding the affordable
number means adjusting it by hand and re-running until savings stay solvent.
Invert it.

Intent:

- Take a minimum savings threshold as the input (the floor the balance must not
  breach at any point through to 2050).
- Solve for the highest sustainable target annual spend that keeps projected
  savings at or above that floor for the whole projection, and write the result
  back into the target spend field.
- Bisection over the existing `simulate()` is sufficient; the relationship
  between spend and terminal savings is monotonic, so it converges quickly.
- Present it as an "Auto-optimise" action next to Run Simulation, not as a mode:
  it computes a number, populates the field, and leaves the user free to
  override it.

This supersedes the original "minimum threshold for Savings" requirement as a
warning trigger — the threshold becomes the constraint that drives the
calculation rather than an alert after the fact.
