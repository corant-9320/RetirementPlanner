---
inclusion: auto
---

# Validation Workflow

Before completion, run `npm run check`. It executes all `node:test` files and the Vite production build. Use targeted `node --test test/<file>.test.js` while iterating, but still run the full check at the end.

Tests are executable financial specifications. Add boundary cases for changed formulas, dates, tax attribution, persistence schemas and history behavior. A successful build alone does not validate financial correctness.

For UI changes, also smoke-test the default simulation, an invalid input, save/load/delete, undo/redo, annual expansion, column reorder, zero/single-result chart behavior and a narrow viewport. Never deploy if checks fail.
