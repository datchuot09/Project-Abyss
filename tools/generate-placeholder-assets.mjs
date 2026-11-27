#!/usr/bin/env node
// PROJECT ABYSS – development placeholder generator.
//
// Produces original pixel art (no third-party assets) as real PNG files plus a
// Tiled-compatible test map, so the whole asset pipeline (manifest -> loader ->
// Phaser cache) is exercised exactly as it will be with final Aseprite art.
//
// Existing files are NOT overwritten unless --force is given, so hand-made
// replacements (Aseprite exports, maps edited in Tiled) are safe.
//
// Usage: npm run assets            (create missing files)
//        npm run assets -- --force (regenerate everything)
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PixelCanvas, hex, mulberry32 } from './lib/png.mjs';
import { FONT_GLYPHS, FONT_METRICS } from './lib/font5x7.mjs';
import { buildPlayerSheet } from './art/player.mjs';
import { buildGhoul, buildBoneArcher, buildAbyssMite } from './art/monsters.mjs';
import { buildSlash, buildArcaneBolt, buildArrow, buildHitSpark, buildShadow, buildCrosshair } from './art/effects.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const FORCE = process.argv.includes('--force');
const written = [];
const skipped = [];

function shouldWrite(path) {
  if (!FORCE && existsSync(path)) {
    skipped.push(path.replace(ROOT + '/', ''));
    return false;
  }
  written.push(path.replace(ROOT + '/', ''));
  return true;
}

function savePNG(canvas, rel) {
  const path = join(PUBLIC, rel);
  if (shouldWrite(path)) canvas.save(path);
}

function saveText(rel, text) {
  const path = join(PUBLIC, rel);
  if (!shouldWrite(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

// ---------------------------------------------------------------------------
// Palette – Dark Fantasy, cold stone with warm torch accents
// ---------------------------------------------------------------------------
const P = {
  void: '#08070c',
  grout: '#16131c',
  stone: ['#2a2633', '#2e2a38', '#322d3d'],
  stoneDark: '#211e29',
  stoneLight: '#3d3749',
  crack: '#110f16',
  moss: ['#2c4429', '#3a5933', '#24361f'],
  rune: '#3a2e5c',
  runeGlow: '#7a5cc8',
  wallTop: ['#141119', '#17141d', '#120f16'],
  wallTopRim: '#2b2535',
  brick: ['#2f2a3a', '#342e40', '#2b2635'],
  brickLight: '#423a51',
  mortar: '#18151f',
  lip: '#4b4359',
  lip2: '#393245',
  baseShadow: '#100d15',
  bone: '#cfc6b0',
  boneShade: '#8f8672',
  web: '#9894a6aa',
  ironDark: '#2f2c36',
  iron: '#575261',
  wood: '#5b3b22',
  flame: ['#fff2b0', '#ffc85a', '#ff8a24', '#c2410c'],
  outline: '#07060b'
};

// ---------------------------------------------------------------------------
// Tileset (16x16 tiles, extruded by 1px: margin 1, spacing 2)
// ---------------------------------------------------------------------------
const TILE = 16;
const TS_COLS = 8;
const TS_ROWS = 4;
export const TILES = {
  VOID: 0,
  FLOOR_A: 1,
  FLOOR_B: 2,
  FLOOR_C: 3,
  FLOOR_D: 4,
  FLOOR_CRACKED: 5,
  FLOOR_MOSS: 6,
  FLOOR_RUNE: 7,
  WALL_TOP: 8,
  WALL_FACE_A: 9,
  WALL_FACE_B: 10,
  WALL_FACE_MOSS: 11,
  DECOR_BONES: 16,
  DECOR_RUBBLE: 17,
  DECOR_SKULL: 18,
  DECOR_WEB: 19
};
const COLLIDING_TILES = [TILES.VOID, TILES.WALL_TOP, TILES.WALL_FACE_A, TILES.WALL_FACE_B, TILES.WALL_FACE_MOSS];

function slab(c, x, y, w, h, rng) {
  const base = P.stone[Math.floor(rng() * P.stone.length)];
  c.rect(x, y, w, h, base);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const r = rng();
      if (r < 0.08) c.set(xx, yy, P.stoneDark);
      else if (r < 0.12) c.set(xx, yy, P.stoneLight);
    }
  }
  // inner bevel: light top/left, grout bottom/right
  for (let xx = x; xx < x + w - 1; xx++) if (rng() < 0.7) c.set(xx, y, P.stoneLight);
  for (let yy = y; yy < y + h - 1; yy++) if (rng() < 0.5) c.set(x, yy, P.stoneLight);
  c.rect(x, y + h - 1, w, 1, P.grout);
  c.rect(x + w - 1, y, 1, h, P.grout);
}

function drawFloor(c, ox, oy, kind, seed) {
  const rng = mulberry32(seed);
  if (kind === 'a') {
    slab(c, ox, oy, 16, 8, rng);
    slab(c, ox, oy + 8, 16, 8, rng);
  } else if (kind === 'b') {
    slab(c, ox, oy, 8, 8, rng);
    slab(c, ox + 8, oy, 8, 8, rng);
    slab(c, ox, oy + 8, 8, 8, rng);
    slab(c, ox + 8, oy + 8, 8, 8, rng);
  } else if (kind === 'c') {
    slab(c, ox, oy, 16, 16, rng);
  } else {
    slab(c, ox, oy, 10, 16, rng);
    slab(c, ox + 10, oy, 6, 7, rng);
    slab(c, ox + 10, oy + 7, 6, 9, rng);
  }
}

function drawCrack(c, ox, oy, seed) {
  const rng = mulberry32(seed);
  let x = 2 + Math.floor(rng() * 4);
  let y = 1;
  while (y < 15) {
    c.set(ox + x, oy + y, P.crack);
    if (rng() < 0.35) c.set(ox + x + 1, oy + y, P.stoneDark);
    x = Math.max(1, Math.min(14, x + (rng() < 0.5 ? 1 : rng() < 0.5 ? -1 : 0)));
    y += rng() < 0.75 ? 1 : 0;
  }
}

function drawMoss(c, ox, oy, seed) {
  const rng = mulberry32(seed);
  for (let i = 0; i < 3; i++) {
    const cx = 3 + Math.floor(rng() * 10);
    const cy = 3 + Math.floor(rng() * 10);
    for (let yy = -2; yy <= 2; yy++) {
      for (let xx = -3; xx <= 3; xx++) {
        if (xx * xx + yy * yy * 2 <= 7 && rng() < 0.75) c.set(ox + cx + xx, oy + cy + yy, P.moss[Math.floor(rng() * 3)]);
      }
    }
  }
}

function drawRune(c, ox, oy) {
  for (let a = 0; a < 32; a++) {
    const t = (a / 32) * Math.PI * 2;
    c.set(ox + 8 + Math.round(Math.cos(t) * 5), oy + 8 + Math.round(Math.sin(t) * 5), P.rune);
  }
  for (const [x, y] of [[8, 3], [13, 8], [8, 13], [3, 8], [8, 8]]) c.set(ox + x, oy + y, P.runeGlow);
  for (let i = -2; i <= 2; i++) {
    c.set(ox + 8 + i, oy + 8, P.rune);
    c.set(ox + 8, oy + 8 + i, P.rune);
  }
  c.set(ox + 8, oy + 8, P.runeGlow);
}

function drawWallTop(c, ox, oy, seed) {
  // Cap stones: distinctly lighter than the void so walls/pillars read as
  // solid masonry, not holes. Rim light top/left, shadow bottom/right.
  const rng = mulberry32(seed);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.set(ox + x, oy + y, P.wallTop[Math.floor(rng() * 3)]);
  c.rect(ox, oy, 16, 1, P.wallTopRim);
  c.rect(ox, oy, 1, 16, P.wallTopRim);
  c.rect(ox, oy + 15, 16, 1, P.void);
  c.rect(ox + 15, oy, 1, 16, P.void);
}

function drawWallFace(c, ox, oy, variant, seed) {
  const rng = mulberry32(seed);
  c.rect(ox, oy, 16, 16, P.mortar);
  c.rect(ox, oy, 16, 1, P.lip);
  c.rect(ox, oy + 1, 16, 1, P.lip2);
  const rows = [2, 6, 10];
  rows.forEach((by, ri) => {
    const offset = ri % 2 === 0 ? 0 : -4;
    for (let bx = offset; bx < 16; bx += 8) {
      const x0 = Math.max(0, bx);
      const x1 = Math.min(15, bx + 6);
      if (x1 < x0) continue;
      const missing = variant === 'b' && rng() < 0.18;
      const col = missing ? '#0e0c12' : P.brick[Math.floor(rng() * 3)];
      for (let y = by; y < by + 3; y++) for (let x = x0; x <= x1; x++) c.set(ox + x, oy + y, col);
      if (!missing) {
        for (let x = x0; x <= x1; x++) c.set(ox + x, oy + by, P.brickLight);
        for (let y = by; y < by + 3; y++) for (let x = x0; x <= x1; x++) if (rng() < 0.08) c.set(ox + x, oy + y, P.mortar);
      }
    }
  });
  c.rect(ox, oy + 14, 16, 2, P.baseShadow);
  if (variant === 'moss') {
    for (let x = 0; x < 16; x++) {
      const len = rng() < 0.45 ? 1 + Math.floor(rng() * 5) : 0;
      for (let y = 1; y <= len; y++) c.set(ox + x, oy + y, P.moss[Math.floor(rng() * 3)]);
    }
  }
}

function drawBones(c, ox, oy) {
  const bone = (x0, y0, x1, y1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      c.set(ox + x, oy + y, P.bone);
      c.set(ox + x, oy + y + 1, P.boneShade);
    }
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      c.set(ox + x - 1, oy + y, P.bone);
      c.set(ox + x + 1, oy + y, P.bone);
    }
  };
  bone(3, 5, 12, 10);
  bone(4, 11, 11, 6);
}

function drawRubble(c, ox, oy, seed) {
  const rng = mulberry32(seed);
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(rng() * 11);
    const y = 4 + Math.floor(rng() * 9);
    const s = 1 + Math.floor(rng() * 2);
    c.rect(ox + x, oy + y + 1, s + 1, s, P.grout);
    c.rect(ox + x, oy + y, s + 1, s, P.stoneLight);
    c.set(ox + x, oy + y, '#4d4560');
  }
}

function drawSkull(c, ox, oy) {
  const rows = ['.####.', '######', '#..#.#', '######', '.#.#.#'];
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '#') c.set(ox + 5 + x, oy + 6 + y, y === 3 ? P.boneShade : P.bone);
    if (ch === '.' && y === 2) c.set(ox + 5 + x, oy + 6 + y, P.outline);
  }));
  c.rect(ox + 5, oy + 11, 6, 1, '#00000055');
}

function drawWeb(c, ox, oy) {
  for (let i = 0; i < 9; i++) {
    c.set(ox + i, oy, P.web);
    c.set(ox, oy + i, P.web);
    c.set(ox + i, oy + i, P.web);
  }
  for (let i = 0; i <= 4; i++) {
    c.set(ox + 4 - i, oy + i, P.web);
    c.set(ox + 7 - i, oy + i, P.web);
  }
}

function buildTileset() {
  const tiles = new PixelCanvas(TS_COLS * TILE, TS_ROWS * TILE);
  const at = (i) => [(i % TS_COLS) * TILE, Math.floor(i / TS_COLS) * TILE];
  tiles.rect(...at(TILES.VOID), 16, 16, P.void);
  drawFloor(tiles, ...at(TILES.FLOOR_A), 'a', 11);
  drawFloor(tiles, ...at(TILES.FLOOR_B), 'b', 23);
  drawFloor(tiles, ...at(TILES.FLOOR_C), 'c', 37);
  drawFloor(tiles, ...at(TILES.FLOOR_D), 'd', 41);
  drawFloor(tiles, ...at(TILES.FLOOR_CRACKED), 'b', 53);
  drawCrack(tiles, ...at(TILES.FLOOR_CRACKED), 7);
  drawFloor(tiles, ...at(TILES.FLOOR_MOSS), 'a', 61);
  drawMoss(tiles, ...at(TILES.FLOOR_MOSS), 5);
  drawFloor(tiles, ...at(TILES.FLOOR_RUNE), 'c', 71);
  drawRune(tiles, ...at(TILES.FLOOR_RUNE));
  drawWallTop(tiles, ...at(TILES.WALL_TOP), 83);
  drawWallFace(tiles, ...at(TILES.WALL_FACE_A), 'a', 89);
  drawWallFace(tiles, ...at(TILES.WALL_FACE_B), 'b', 97);
  drawWallFace(tiles, ...at(TILES.WALL_FACE_MOSS), 'moss', 101);
  drawBones(tiles, ...at(TILES.DECOR_BONES));
  drawRubble(tiles, ...at(TILES.DECOR_RUBBLE), 113);
  drawSkull(tiles, ...at(TILES.DECOR_SKULL));
  drawWeb(tiles, ...at(TILES.DECOR_WEB));

  // Extrude: margin 1, spacing 2 – prevents texture bleeding at any zoom.
  const stride = TILE + 2;
  const out = new PixelCanvas(TS_COLS * stride, TS_ROWS * stride);
  for (let i = 0; i < TS_COLS * TS_ROWS; i++) {
    const [sx, sy] = at(i);
    const dx = (i % TS_COLS) * stride + 1;
    const dy = Math.floor(i / TS_COLS) * stride + 1;
    out.blit(tiles, sx, sy, TILE, TILE, dx, dy);
    out.blit(tiles, sx, sy, TILE, 1, dx, dy - 1);
    out.blit(tiles, sx, sy + TILE - 1, TILE, 1, dx, dy + TILE);
    out.blit(tiles, sx, sy, 1, TILE, dx - 1, dy);
    out.blit(tiles, sx + TILE - 1, sy, 1, TILE, dx + TILE, dy);
    out.set(dx - 1, dy - 1, tiles.get(sx, sy));
    out.set(dx + TILE, dy - 1, tiles.get(sx + TILE - 1, sy));
    out.set(dx - 1, dy + TILE, tiles.get(sx, sy + TILE - 1));
    out.set(dx + TILE, dy + TILE, tiles.get(sx + TILE - 1, sy + TILE - 1));
  }
  savePNG(out, 'assets/tilesets/dungeon_tiles.png');
  return { width: out.width, height: out.height };
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
function buildTorch() {
  const sheet = new PixelCanvas(16 * 4, 16);
  const flames = [
    ['..1..', '.121.', '.232.', '12321', '.343.'],
    ['.1...', '.12..', '.2321', '12321', '.343.'],
    ['...1.', '..21.', '12321', '12321', '.343.'],
    ['..1..', '.121.', '12321', '.2332', '.343.']
  ];
  for (let f = 0; f < 4; f++) {
    const ox = f * 16;
    sheet.rect(ox + 7, 8, 2, 4, P.wood);
    sheet.rect(ox + 6, 11, 4, 1, P.iron);
    sheet.rect(ox + 7, 12, 2, 2, P.ironDark);
    sheet.set(ox + 6, 8, P.iron);
    sheet.set(ox + 9, 8, P.iron);
    flames[f].forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === '.') return;
      sheet.set(ox + 6 + x - 0, 3 + y, P.flame[Number(ch) - 1]);
    }));
    sheet.outline(ox, 0, 16, 16, P.outline);
  }
  savePNG(sheet, 'assets/effects/torch.png');
}

function buildGlow() {
  const size = 64;
  const c = new PixelCanvas(size, size);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
      if (d >= 1) continue;
      // Quantised falloff keeps the glow "pixel art" banded rather than smooth.
      const band = Math.ceil((1 - d) * 6) / 6;
      c.set(x, y, [255, 255, 255, Math.round(band * band * 200)]);
    }
  }
  savePNG(c, 'assets/effects/light_glow.png');
}

// ---------------------------------------------------------------------------
// Bitmap font (BMFont XML) with baked 1px shadow
// ---------------------------------------------------------------------------
function buildFont() {
  const chars = Object.keys(FONT_GLYPHS);
  const cellW = 7;
  const cellH = FONT_METRICS.cellHeight;
  const cols = 16;
  const rows = Math.ceil(chars.length / cols);
  const c = new PixelCanvas(cols * cellW, rows * cellH);
  const ink = hex('#ffffff');
  const shadow = hex('#1a1424');
  const entries = [];
  chars.forEach((ch, i) => {
    const ox = (i % cols) * cellW;
    const oy = Math.floor(i / cols) * cellH;
    const glyph = FONT_GLYPHS[ch];
    let width = FONT_METRICS.spaceAdvance - FONT_METRICS.letterSpacing;
    if (glyph) {
      width = glyph[0].length;
      glyph.forEach((r, y) => [...r].forEach((bit, x) => { if (bit === '1') c.set(ox + x + 1, oy + y + 1, shadow); }));
      glyph.forEach((r, y) => [...r].forEach((bit, x) => { if (bit === '1') c.set(ox + x, oy + y, ink); }));
    }
    entries.push(
      `    <char id="${ch.codePointAt(0)}" x="${ox}" y="${oy}" width="${glyph ? width + 1 : 1}" height="${cellH}" xoffset="0" yoffset="0" xadvance="${width + FONT_METRICS.letterSpacing}" page="0" chnl="15" />`
    );
  });
  savePNG(c, 'assets/fonts/abyss_font.png');
  const xml = `<?xml version="1.0"?>
<font>
  <info face="AbyssPixel" size="${FONT_METRICS.lineHeight}" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="0" aa="0" padding="0,0,0,0" spacing="1,1" />
  <common lineHeight="${FONT_METRICS.lineHeight}" base="${FONT_METRICS.base}" scaleW="${c.width}" scaleH="${c.height}" pages="1" packed="0" />
  <pages>
    <page id="0" file="abyss_font.png" />
  </pages>
  <chars count="${chars.length}">
${entries.join('\n')}
  </chars>
</font>
`;
  saveText('assets/fonts/abyss_font.xml', xml);
}

// ---------------------------------------------------------------------------
// Test floor – Tiled JSON (orthogonal, 16px). Editable in Tiled afterwards.
// ---------------------------------------------------------------------------
function buildTestMap(tilesetSize) {
  const W = 48;
  const H = 34;
  const rng = mulberry32(1337);
  const grid = Array.from({ length: H }, () => Array(W).fill('#'));
  const carve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = '.'; };
  const block = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) grid[y][x] = '#'; };

  carve(3, 4, 21, 18); // Antechamber
  carve(22, 10, 28, 12); // East corridor
  carve(29, 5, 44, 27); // Hall of pillars
  carve(10, 19, 12, 22); // South corridor
  carve(5, 23, 19, 30); // Crypt
  block(7, 8, 2, 2); block(15, 8, 2, 2); block(7, 14, 2, 2); block(15, 14, 2, 2);
  block(33, 10, 2, 2); block(39, 10, 2, 2); block(33, 17, 2, 2); block(39, 17, 2, 2); block(33, 23, 2, 2); block(39, 23, 2, 2);

  const isFloor = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y][x] === '.';
  const nearFloor = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isFloor(x + dx, y + dy)) return true;
    return false;
  };

  const floor = [];
  const walls = [];
  const decor = [];
  const torches = [];
  const gid = (t) => t + 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isFloor(x, y)) {
        const r = rng();
        const t = r < 0.04 ? TILES.FLOOR_CRACKED : r < 0.08 ? TILES.FLOOR_MOSS : r < 0.09 ? TILES.FLOOR_RUNE
          : [TILES.FLOOR_A, TILES.FLOOR_B, TILES.FLOOR_C, TILES.FLOOR_D][Math.floor(rng() * 4)];
        floor.push(gid(t));
        walls.push(0);
        const d = rng();
        decor.push(d < 0.025 ? gid(TILES.DECOR_BONES) : d < 0.05 ? gid(TILES.DECOR_RUBBLE) : d < 0.06 ? gid(TILES.DECOR_SKULL) : 0);
      } else {
        floor.push(0);
        decor.push(0);
        if (isFloor(x, y + 1)) {
          const r = rng();
          walls.push(gid(r < 0.15 ? TILES.WALL_FACE_MOSS : r < 0.35 ? TILES.WALL_FACE_B : TILES.WALL_FACE_A));
          if (x % 5 === 0 && !isFloor(x - 1, y) && !isFloor(x + 1, y) && isFloor(x - 1, y + 1) && isFloor(x + 1, y + 1)) {
            torches.push({ x, y });
          }
        } else if (nearFloor(x, y)) walls.push(gid(TILES.WALL_TOP));
        else walls.push(gid(TILES.VOID));
      }
    }
  }
  // Cobwebs in top-left inner corners
  for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) {
    const i = y * W + x;
    if (isFloor(x, y) && !isFloor(x - 1, y) && !isFloor(x, y - 1) && rng() < 0.6) decor[i] = gid(TILES.DECOR_WEB);
  }

  let nextId = 1;
  const point = (name, type, tx, ty, props = []) => ({
    id: nextId++, name, type, point: true, rotation: 0, visible: true,
    x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, width: 0, height: 0, properties: props
  });

  const monster = (name, tx, ty, type, group) =>
    point('enemy_spawn', 'enemy_spawn', tx, ty, [
      { name: 'monster', type: 'string', value: type },
      { name: 'group', type: 'string', value: group }
    ]);
  const spawns = [
    point('player_spawn', 'player_spawn', 8, 12),
    monster('enemy_spawn', 18, 6, 'ghoul', 'antechamber'),
    monster('enemy_spawn', 17, 17, 'abyss_mite', 'antechamber'),
    monster('enemy_spawn', 36, 8, 'ghoul', 'hall'),
    monster('enemy_spawn', 42, 14, 'bone_archer', 'hall'),
    monster('enemy_spawn', 36, 21, 'ghoul', 'hall'),
    monster('enemy_spawn', 43, 25, 'bone_archer', 'hall'),
    monster('enemy_spawn', 12, 27, 'abyss_mite', 'crypt'),
    monster('enemy_spawn', 17, 25, 'abyss_mite', 'crypt'),
    monster('enemy_spawn', 8, 29, 'abyss_mite', 'crypt'),
    point('exit', 'exit', 41, 26)
  ];
  const lights = torches.map((t) => ({
    id: nextId++, name: 'torch', type: 'torch', point: true, rotation: 0, visible: true,
    x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2, width: 0, height: 0,
    properties: [{ name: 'radius', type: 'int', value: 56 }, { name: 'color', type: 'color', value: '#ffffb060' }]
  }));

  const tileLayer = (id, name, data) => ({ id, name, type: 'tilelayer', data, width: W, height: H, opacity: 1, visible: true, x: 0, y: 0 });
  const map = {
    compressionlevel: -1,
    width: W,
    height: H,
    tilewidth: TILE,
    tileheight: TILE,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    type: 'map',
    version: '1.10',
    nextlayerid: 6,
    nextobjectid: nextId,
    properties: [
      { name: 'floorName', type: 'string', value: 'The Sunken Antechamber' },
      { name: 'description', type: 'string', value: 'Cold stone and colder silence. Something below is listening.' },
      { name: 'ambientColor', type: 'color', value: '#ff9aa0c8' }
    ],
    layers: [
      tileLayer(1, 'Floor', floor),
      tileLayer(2, 'Decor', decor),
      tileLayer(3, 'Walls', walls),
      { id: 4, name: 'Spawns', type: 'objectgroup', draworder: 'topdown', objects: spawns, opacity: 1, visible: true, x: 0, y: 0 },
      { id: 5, name: 'Lights', type: 'objectgroup', draworder: 'topdown', objects: lights, opacity: 1, visible: true, x: 0, y: 0 }
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'dungeon_tiles',
        image: '../../assets/tilesets/dungeon_tiles.png',
        imagewidth: tilesetSize.width,
        imageheight: tilesetSize.height,
        tilewidth: TILE,
        tileheight: TILE,
        margin: 1,
        spacing: 2,
        columns: TS_COLS,
        tilecount: TS_COLS * TS_ROWS,
        tiles: COLLIDING_TILES.map((id) => ({ id, properties: [{ name: 'collides', type: 'bool', value: true }] }))
      }
    ]
  };
  saveText('data/dungeons/test_chamber.json', JSON.stringify(map));
}

function buildParticles() {
  const white = new PixelCanvas(1, 1);
  white.set(0, 0, '#ffffff');
  savePNG(white, 'assets/effects/px_white.png');
  const ember = new PixelCanvas(2, 2);
  ember.rect(0, 0, 2, 2, '#ffffff');
  savePNG(ember, 'assets/effects/ember.png');
}

const tilesetSize = buildTileset();
buildParticles();
savePNG(buildPlayerSheet(), 'assets/characters/wanderer.png');
savePNG(buildGhoul(), 'assets/monsters/ghoul.png');
savePNG(buildBoneArcher(), 'assets/monsters/bone_archer.png');
savePNG(buildAbyssMite(), 'assets/monsters/abyss_mite.png');
savePNG(buildSlash(), 'assets/effects/slash.png');
savePNG(buildArcaneBolt(), 'assets/effects/arcane_bolt.png');
savePNG(buildArrow(), 'assets/effects/arrow.png');
savePNG(buildHitSpark(), 'assets/effects/hit_spark.png');
savePNG(buildShadow(), 'assets/effects/shadow.png');
savePNG(buildCrosshair(), 'assets/ui/crosshair.png');
buildTorch();
buildGlow();
buildFont();
buildTestMap(tilesetSize);

console.log(`[assets] written: ${written.length}`);
written.forEach((f) => console.log('  +', f));
if (skipped.length) {
  console.log(`[assets] skipped (already exist, use --force to overwrite): ${skipped.length}`);
  skipped.forEach((f) => console.log('  =', f));
}
