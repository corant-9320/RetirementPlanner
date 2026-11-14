---
inclusion: fileMatch
fileMatchPattern: 'src/{storage,form,history,main}.js'
---

# Persistence and History Rules

`FormSnapshot` contains raw UI values, field currencies, select values and cloned events. `SimulationParams` contains only normalized GBP domain inputs. Never mix these contracts.

Scenario storage uses `STORAGE_SCHEMA_VERSION` and `{version, scenarios}`. Any shape change must include a pure migration, malformed-data handling, detached clones and tests for old/current schemas. localStorage read/write failures must be user-visible and must not destroy existing content.

Column order must contain every known key exactly once with `year` first. Invalid persisted orders fall back safely.

History stores complete `FormSnapshot` values, coalesces edits, caps retained entries and must not recursively record restoration. Loading a scenario is one undoable change.
