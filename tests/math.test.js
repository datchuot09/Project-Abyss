import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMove, approachFactor, parseTiledColor } from '../src/core/math.js';

test('diagonal keyboard movement is not faster than straight', () => {
  const d = normalizeMove(1, 1);
  assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9);
  assert.deepEqual(normalizeMove(1, 0), { x: 1, y: 0 });
  assert.deepEqual(normalizeMove(0, 0), { x: 0, y: 0 });
});

test('analog deadzone and rescale', () => {
  assert.deepEqual(normalizeMove(0.1, 0.1, 0.2), { x: 0, y: 0 });
  const full = normalizeMove(1, 0, 0.2);
  assert.ok(Math.abs(full.x - 1) < 1e-9);
  const half = normalizeMove(0.6, 0, 0.2);
  assert.ok(Math.abs(half.x - 0.5) < 1e-9);
});

test('approachFactor is frame-rate independent', () => {
  const one = approachFactor(10, 1 / 30);
  const two = 1 - (1 - approachFactor(10, 1 / 60)) ** 2;
  assert.ok(Math.abs(one - two) < 1e-9);
});

test('parseTiledColor handles #AARRGGBB and #RRGGBB', () => {
  assert.equal(parseTiledColor('#ffffb060'), 0xffb060);
  assert.equal(parseTiledColor('#9aa0c8'), 0x9aa0c8);
  assert.equal(parseTiledColor(undefined, 7), 7);
});
