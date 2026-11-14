---
inclusion: auto
---

# Where to Edit

- Parameter/result/snapshot contracts: `src/contracts.js`.
- Input rules and user-facing domain constraints: `src/validation.js`; DOM error mapping: `src/main.js`.
- Financial timing, balances, property transitions and quarterly tax coordination: `src/simulation.js`. Keep it pure.
- Tax bands, savings relief, attribution and annual→quarterly rates: `src/utils.js`.
- Calendar-year sums and endpoint balances: `src/annual.js`; table interaction: `src/render.js`; column formatting/order: `src/columns.js`.
- Form markup/defaults: `index.html`; field registry, reading, currency and snapshots: `src/form.js`.
- Run/save/load/delete/history workflows: `src/main.js`; generic undo behavior: `src/history.js`.
- Scenario schema/migration: `src/storage.js`; restore: `src/form.js`; load workflow: `src/main.js`.
- Events: `src/events.js`; chart: `src/chart.js`; layout/accessibility styling: `src/styles.css`.
- Product assumptions: `REQUIREMENTS.md`; release/rollback: `DEPLOYMENT.md`.

## Coordinated-change checklist

1. Trace a field through `index.html` → `FIELD_SCHEMA`/`readParams` → validation → simulation → annual aggregation → columns.
2. Keep `SimulationParams`, `FormSnapshot`, and `StoredScenario` separate.
3. Preserve cash reconciliation, exact annual compounding, one-shot transitions, tax-year boundaries, annual sum/endpoint semantics and determinism.
4. Add focused tests under `test/`; storage changes need malformed and legacy cases, history changes need undo/redo/limit cases.
5. Run `npm run check`. Do not report completion when tests or build fail.
