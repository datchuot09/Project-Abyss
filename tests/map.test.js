import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateMap, findNearestWalkable, floodFill } from '../src/world/MapValidator.js';

const map = JSON.parse(readFileSync(new URL('../public/data/dungeons/test_chamber.json', import.meta.url)));
const layer = (name) => map.layers.find((l) => l.name === name);
const tileset = map.tilesets[0];
const colliding = new Set(
  tileset.tiles.filter((t) => t.properties?.some((p) => p.name === 'collides' && p.value)).map((t) => t.id + tileset.firstgid)
);

function grid() {
  const floor = layer('Floor').data;
  const walls = layer('Walls').data;
  return Uint8Array.from(floor, (f, i) => (colliding.has(walls[i]) || f === 0 ? 1 : 0));
}

test('test_chamber has the layers DungeonMap expects', () => {
  for (const n of ['Floor', 'Decor', 'Walls', 'Spawns', 'Lights']) assert.ok(layer(n), `missing layer ${n}`);
  assert.equal(tileset.name, 'dungeon_tiles');
});

test('every spawn is on walkable ground and reachable from the player', () => {
  const g = grid();
  const spawns = layer('Spawns').objects.map((o) => ({
    name: o.type || o.name,
    tx: Math.floor(o.x / map.tilewidth),
    ty: Math.floor(o.y / map.tileheight)
  }));
  const r = validateMap({ grid: g, width: map.width, height: map.height, spawns });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.reachable, r.walkable);
});

test('map border is fully solid (player cannot leave the map)', () => {
  const g = grid();
  for (let x = 0; x < map.width; x++) {
    assert.equal(g[x], 1);
    assert.equal(g[(map.height - 1) * map.width + x], 1);
  }
  for (let y = 0; y < map.height; y++) {
    assert.equal(g[y * map.width], 1);
    assert.equal(g[y * map.width + map.width - 1], 1);
  }
});

test('validator rejects spawns inside walls and finds a safe tile', () => {
  const w = 5, h = 5;
  const g = Uint8Array.from({ length: 25 }, (_, i) => (i % 5 === 0 || i % 5 === 4 || i < 5 || i >= 20 ? 1 : 0));
  const bad = validateMap({ grid: g, width: w, height: h, spawns: [{ name: 'player_spawn', tx: 0, ty: 0 }] });
  assert.equal(bad.ok, false);
  assert.deepEqual(findNearestWalkable(g, w, h, 0, 0), { tx: 1, ty: 1 });
  assert.equal(floodFill(g, w, h, 2, 2).reduce((a, b) => a + b, 0), 9);
});
