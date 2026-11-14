---
inclusion: auto
---

# Retirement Planner — Project Overview

Client-only deterministic retirement cash-flow planner using vanilla ES modules, Vite, CSS, canvas, and versioned browser `localStorage`. There is no backend, authentication, account sync, IP restriction, or supported cross-browser scenario transfer.

## Required commands

- Install reproducibly: `npm ci`
- Validate every change: `npm run check` (all Node tests, then production build)
- Run one test file: `node --test test/<name>.test.js`
- Local development: `npm run dev`; production preview: `npm run preview`
- Deployment procedure and safety checks: `DEPLOYMENT.md`

## Module boundaries

| Module | Responsibility | Browser coupling |
|---|---|---|
| `main.js` | Composition root, app/UI state, validation and workflow orchestration | DOM |
| `contracts.js` | JSDoc domain, result, snapshot and storage contracts | None |
| `validation.js` | Pure `SimulationParams` validation; never silently repairs values | None |
| `simulation.js` | Pure deterministic quarterly projection and tax-year coordination | None |
| `annual.js` | Pure calendar-year aggregation of quarterly results | None |
| `utils.js` | Formatting, compounding, tax bands and household tax | None |
| `form.js` | Declarative field registry, DOM→GBP params, currency state, snapshots | DOM |
| `history.js` | Generic snapshot undo/redo, coalescing and limits | Timers only |
| `storage.js` | Versioned scenario schema, validation, migration and CRUD | `localStorage` |
| `columns.js` | Column metadata/cells/tooltips and validated persisted order | `localStorage` |
| `render.js` | Warnings, table, expansion and drag coordination | DOM |
| `chart.js` | Empty/single/multi-point HiDPI chart and text summary | canvas/window |
| `events.js` | Accessible one-off event controls and event-array mutation | DOM |

Flow: form snapshot/state → `readParams(events)` → `validateParams(params)` → `simulate(params,startFY)` → `aggregateAnnual(results)` → table/chart. Simulation params must never contain persistence metadata.

## Non-negotiable boundaries

Keep financial logic DOM-free and deterministic. All simulation money is GBP. The caller supplies the start quarter. Persisted shape changes require migration tests. Every financial change needs boundary tests and must preserve the invariants in `financial-model.md`.
