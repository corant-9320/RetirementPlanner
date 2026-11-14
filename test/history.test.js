import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../src/history.js';

function setup(limit = 100) {
  let value = 0;
  const applied = [];
  const history = createHistory({
    capture: () => ({ value }),
    apply: snapshot => { value = snapshot.value; applied.push(value); },
    limit,
  });
  return {
    history,
    get value() { return value; },
    set value(next) { value = next; },
    applied,
  };
}

test('undo and redo restore snapshots and expose availability', () => {
  const state = setup();
  state.value = 1;
  assert.equal(state.history.flush(), true);
  assert.equal(state.history.canUndo(), true);
  assert.equal(state.history.undo(), true);
  assert.equal(state.value, 0);
  assert.equal(state.history.canRedo(), true);
  assert.equal(state.history.redo(), true);
  assert.equal(state.value, 1);
});

test('a new commit invalidates redo and duplicate snapshots are ignored', () => {
  const state = setup();
  assert.equal(state.history.flush(), false);
  state.value = 1;
  state.history.flush();
  state.history.undo();
  state.value = 2;
  state.history.flush();
  assert.equal(state.history.canRedo(), false);
});

test('history limit drops the oldest snapshots and reset establishes a baseline', () => {
  const state = setup(2);
  for (const value of [1, 2, 3]) { state.value = value; state.history.flush(); }
  assert.equal(state.history.undo(), true);
  assert.equal(state.value, 2);
  assert.equal(state.history.undo(), true);
  assert.equal(state.value, 1);
  assert.equal(state.history.undo(), false);
  state.history.reset();
  assert.equal(state.history.canUndo(), false);
});

test('record coalesces a burst and ignores recording triggered during apply', async () => {
  let value = 0;
  let history;
  history = createHistory({
    capture: () => ({ value }),
    apply: snapshot => { value = snapshot.value; history.record(); },
  });
  value = 1;
  history.record();
  value = 2;
  history.record();
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(history.canUndo(), true);
  assert.equal(history.undo(), true);
  assert.equal(value, 0);
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(history.canUndo(), false);
});