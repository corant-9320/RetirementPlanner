# Retirement Planner

A client-side deterministic retirement cash-flow planner. It models quarterly GBP cash flows, pensions, savings/borrowing, property transitions and configurable UK income-tax assumptions, then presents annual and quarterly results.

## Development

Requirements: Node.js `^20.19.0` or `>=22.12.0`.

```powershell
npm ci
npm run check
npm run dev
```

`npm run check` runs all Node tests and the production Vite build. Financial behavior and limitations are documented in `REQUIREMENTS.md`; safe S3 release and rollback steps are in `DEPLOYMENT.md`.

## Architecture

The financial core (`simulation.js`, `utils.js`, `validation.js`, `annual.js`) is pure and browser-independent. Browser modules handle form snapshots, versioned localStorage, history and rendering. Project-specific agent guidance is tracked under `.kiro/steering/`.

All scenario data remains in the current browser's localStorage. There is no backend, account sync, authentication or supported cross-device export.
