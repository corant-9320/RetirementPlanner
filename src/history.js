/**
 * Undo/redo history for parameter changes.
 *
 * Snapshot-based: the whole form state is captured as a plain object after each
 * committed change. Snapshots use the same shape as saved scenarios, so
 * restoreForm() can apply them directly.
 */

const DEFAULT_LIMIT = 100;
const COALESCE_MS = 150;

/**
 * @param {object} opts
 * @param {Function} opts.capture - () => snapshot (plain, JSON-serialisable object)
 * @param {Function} opts.apply - (snapshot) => void, writes a snapshot back to the UI
 * @param {Function} [opts.onChange] - called whenever undo/redo availability changes
 * @param {number} [opts.limit] - max undo steps retained
 */
export function createHistory({ capture, apply, onChange = () => {}, limit = DEFAULT_LIMIT }) {
  const undoStack = [];
  const redoStack = [];
  let present = capture();
  let presentKey = JSON.stringify(present);
  let pendingTimer = null;
  let applying = false;

  function commit() {
    pendingTimer = null;
    if (applying) return false;

    const next = capture();
    const nextKey = JSON.stringify(next);
    if (nextKey === presentKey) return false;

    undoStack.push(present);
    if (undoStack.length > limit) undoStack.shift();
    redoStack.length = 0;
    present = next;
    presentKey = nextKey;
    onChange();
    return true;
  }

  /** Queue a snapshot; coalesces bursts of related events into one step. */
  function record() {
    if (applying) return;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(commit, COALESCE_MS);
  }

  /** Record immediately, cancelling any queued snapshot. */
  function flush() {
    clearTimeout(pendingTimer);
    return commit();
  }

  function move(from, to) {
    flush();
    if (!from.length) return false;
    to.push(present);
    present = from.pop();
    presentKey = JSON.stringify(present);
    applying = true;
    try {
      apply(present);
    } finally {
      applying = false;
    }
    onChange();
    return true;
  }

  return {
    record,
    flush,
    undo: () => move(undoStack, redoStack),
    redo: () => move(redoStack, undoStack),
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    /** Discard history and treat the current UI state as the baseline. */
    reset() {
      clearTimeout(pendingTimer);
      pendingTimer = null;
      undoStack.length = 0;
      redoStack.length = 0;
      present = capture();
      presentKey = JSON.stringify(present);
      onChange();
    },
  };
}
