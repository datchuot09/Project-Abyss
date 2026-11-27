import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFlowField, bestNeighbor, lineOfSight, canStep } from '../src/world/FlowField.js';

// 7x5 room with a wall in the middle column (gap at the bottom)
//   #######
//   #..#..#
//   #..#..#
//   #.....#
//   #######
const rows = ['#######', '#..#..#', '#..#..#', '#.....#', '#######'];
const w = 7, h = 5;
const grid = Uint8Array.from(rows.join(''), (c) => (c === '#' ? 1 : 0));

test('flow field routes around walls', () => {
  const f = computeFlowField(grid, w, h, 5, 1);
  assert.equal(f[1 * w + 5], 0);
  assert.equal(f[1 * w + 3], -1); // wall
  // From (1,1) the path must go down through the gap, so cost > straight line
  assert.ok(f[1 * w + 1] > 40);
  // Following bestNeighbor reaches the target without entering walls
  let p = { tx: 1, ty: 1 };
  for (let i = 0; i < 20 && (p.tx !== 5 || p.ty !== 1); i++) {
    p = bestNeighbor(f, grid, w, h, p.tx, p.ty);
    assert.ok(p, 'path broken');
    assert.equal(grid[p.ty * w + p.tx], 0);
  }
  assert.deepEqual(p, { tx: 5, ty: 1 });
});

test('no diagonal corner cutting', () => {
  assert.equal(canStep(grid, w, h, 2, 2, 1, 1), false); // (3,2) is wall
  assert.equal(canStep(grid, w, h, 2, 3, 1, 0), true);
});

test('retreat moves up the field', () => {
  const f = computeFlowField(grid, w, h, 1, 3);
  const n = bestNeighbor(f, grid, w, h, 2, 3, true);
  assert.ok(f[n.ty * w + n.tx] > f[3 * w + 2]);
});

test('line of sight', () => {
  assert.equal(lineOfSight(grid, w, h, 1.5, 1.5, 2.5, 3.5), true);
  assert.equal(lineOfSight(grid, w, h, 1.5, 1.5, 5.5, 1.5), false);
  assert.equal(lineOfSight(grid, w, h, 1.5, 3.5, 5.5, 3.5), true);
  assert.equal(lineOfSight(grid, w, h, 2.5, 2.5, 4.5, 1.5), false);
});
