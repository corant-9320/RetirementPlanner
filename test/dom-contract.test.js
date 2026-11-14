import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FIELD_SCHEMA } from '../src/form.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('every registered form field has exactly one matching HTML control', () => {
  const registered = new Set();
  for (const field of FIELD_SCHEMA) {
    assert.equal(registered.has(field.id), false, `duplicate registry field: ${field.id}`);
    registered.add(field.id);
    const matches = html.match(new RegExp(`<(?:input|select|textarea)\\b[^>]*\\bid=["']${field.id}["']`, 'g')) || [];
    assert.equal(matches.length, 1, `${field.id} must occur exactly once`);
  }
});

test('application shell contains required accessible output and workflow targets', () => {
  for (const id of [
    'events-list', 'form-errors', 'warnings', 'nw-chart', 'chart-summary',
    'results', 'save-status', 'btn-run', 'btn-save', 'btn-load', 'btn-delete',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  assert.doesNotMatch(html, /Protected by IP lock/i);
  assert.match(html, /aria-describedby="chart-summary"/);
});
