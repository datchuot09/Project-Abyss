// "The Wanderer" – player sprite sheet (24x24 frames).
// Rows: 0 = down, 1 = side (faces right; flipX for left), 2 = up.
// Column layout is mirrored in public/data/characters/wanderer.json.
import { PixelCanvas } from '../lib/png.mjs';
import { OUTLINE, frame } from './common.mjs';

export const PLAYER_LAYOUT = {
  frameWidth: 24,
  frameHeight: 24,
  columns: 28,
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7],
  run: [8, 9, 10, 11],
  attack: [12, 13, 14, 15],
  cast: [16, 17],
  dodge: [18, 19, 20, 21],
  hit: [22],
  death: [23, 24, 25, 26, 27]
};

const C = {
  hood: '#2c3a5c',
  hoodShade: '#1d2642',
  hoodLight: '#41557f',
  face: '#0b0e1c',
  eye: '#8ff0ff',
  eyeDim: '#3f8fa3',
  eyeOff: '#1a2a3a',
  mantle: '#6b2a2e',
  mantleShade: '#4a1c21',
  clasp: '#c8a052',
  cloak: '#26324f',
  cloakShade: '#18203a',
  cloakLight: '#34446a',
  boot: '#2a1f1a',
  bootLight: '#41312a',
  blade: '#dfe6f2',
  bladeEdge: '#8f99ad',
  hilt: '#c8a052',
  orb: '#b99cff',
  orbCore: '#ffffff',
  orbEdge: '#6a4fd0'
};

function drawBody(c, ox, oy, dir, o = {}) {
  const { bob = 0, legs = 'N', hem = 0, eye = C.eye, lean = 0 } = o;
  const f = frame(c, ox, oy);
  const T = bob;
  const L = dir === 'side' ? lean : 0;

  // Boots stay planted (no bob)
  if (dir === 'side') {
    const front = { A: [13, 15], B: [11, 12], N: [12, 14] }[legs];
    const back = { A: [8, 9], B: [10, 11], N: [9, 10] }[legs];
    f.row(20, back[0], back[1], C.boot); f.row(21, back[0], back[1], C.boot);
    f.row(20, front[0], front[1], C.bootLight); f.row(21, front[0], front[1], C.boot);
  } else {
    const leftDown = legs !== 'B';
    const rightDown = legs !== 'A';
    f.row(20, 9, 10, C.bootLight); if (leftDown) f.row(21, 9, 10, C.boot);
    f.row(20, 13, 14, C.bootLight); if (rightDown) f.row(21, 13, 14, C.boot);
  }

  // Cloak
  const top = dir === 'side' ? [8, 15] : [7, 16];
  const bot = dir === 'side' ? [7, 16] : [6, 17];
  for (let y = 12; y <= 19; y++) {
    const [a, b] = y < 16 ? top : bot;
    const s = (y >= 17 ? hem : 0) + (y < 16 ? L : 0);
    if (T + y > 21) continue;
    f.row(T + y, a + s, b + s, C.cloak);
    f.px(a + s, T + y, dir === 'up' ? C.cloakShade : C.cloakLight);
    f.px(a + s + 1, T + y, dir === 'up' ? C.cloak : C.cloakLight);
    f.px(b + s, T + y, C.cloakShade);
    if (dir !== 'side' && y >= 15) f.px(12 + s, T + y, C.cloakShade);
    if (dir === 'side' && y >= 14) f.px(11 + s, T + y, C.cloakShade);
  }

  // Mantle
  if (dir === 'side') {
    f.row(T + 10, 8 + L, 14 + L, C.mantle); f.row(T + 11, 7 + L, 15 + L, C.mantle);
    f.px(7 + L, T + 11, C.mantleShade); f.px(14 + L, T + 11, C.clasp);
    if (o.flutter) { f.px(6 + L, T + 11, C.mantle); f.px(5 + L, T + 12, C.mantleShade); }
  } else {
    f.row(T + 10, 8, 15, C.mantle); f.row(T + 11, 7, 16, C.mantle);
    f.px(16, T + 11, C.mantleShade); f.px(7, T + 11, C.mantleShade);
    if (dir === 'down') { f.px(11, T + 11, C.clasp); f.px(12, T + 11, C.clasp); }
    else f.row(T + 11, 9, 14, C.mantleShade);
  }

  // Hood
  if (dir === 'side') {
    f.row(T + 3, 10 + L, 13 + L, C.hoodLight);
    f.row(T + 4, 9 + L, 14 + L, C.hood);
    for (let y = 5; y <= 9; y++) f.row(T + y, 8 + L, 14 + L, C.hood);
    for (let y = 4; y <= 9; y++) f.px(8 + L, T + y, C.hoodShade);
    f.px(7 + L, T + 8, C.hoodShade); f.px(7 + L, T + 9, C.hoodShade); f.px(6 + L, T + 9, C.hoodShade);
    f.row(T + 6, 13 + L, 14 + L, C.face);
    for (let y = 7; y <= 9; y++) f.row(T + y, 12 + L, 14 + L, C.face);
    f.px(13 + L, T + 8, eye);
  } else {
    f.row(T + 3, 10, 13, C.hoodLight);
    f.row(T + 4, 9, 14, C.hood);
    for (let y = 5; y <= 9; y++) f.row(T + y, 8, 15, C.hood);
    for (let y = 4; y <= 9; y++) { f.px(8, T + y, C.hoodLight); f.px(15, T + y, C.hoodShade); }
    f.px(9, T + 4, C.hoodLight);
    if (dir === 'down') {
      f.row(T + 6, 10, 13, C.face);
      for (let y = 7; y <= 9; y++) f.row(T + y, 9, 14, C.face);
      f.px(10, T + 8, eye); f.px(13, T + 8, eye);
    } else {
      for (let y = 5; y <= 9; y++) f.px(12, T + y, C.hoodShade);
    }
  }
}

function drawSword(c, ox, oy, hx, hy, angleDeg, len = 9) {
  const f = frame(c, ox, oy);
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // hilt / crossguard
  f.px(hx, hy, C.hilt);
  f.px(Math.round(hx - dy), Math.round(hy + dx), C.hilt);
  f.px(Math.round(hx + dy), Math.round(hy - dx), C.hilt);
  for (let i = 1; i <= len; i++) {
    f.px(Math.round(hx + dx * i), Math.round(hy + dy * i), i === len ? C.bladeEdge : C.blade);
    if (i < len - 1) f.px(Math.round(hx + dx * i - dy * 0.6), Math.round(hy + dy * i + dx * 0.6), C.bladeEdge);
  }
}

function drawOrb(c, ox, oy, x, y, big) {
  const f = frame(c, ox, oy);
  if (big) {
    f.row(y - 2, x, x, C.orbEdge); f.row(y - 1, x - 1, x + 1, C.orb); f.row(y, x - 2, x + 2, C.orb);
    f.row(y + 1, x - 1, x + 1, C.orb); f.row(y + 2, x, x, C.orbEdge);
    f.px(x, y, C.orbCore); f.px(x - 1, y, C.orbCore);
  } else {
    f.row(y - 1, x, x, C.orb); f.row(y, x - 1, x + 1, C.orb); f.row(y + 1, x, x, C.orbEdge);
    f.px(x, y, C.orbCore);
  }
}

function drawRollBall(c, ox, oy, phase) {
  const f = frame(c, ox, oy);
  f.shaded(12, 16, 6, 5, C.cloak, C.cloakLight, C.cloakShade);
  if (phase === 0) {
    f.ellipse(15, 13, 2.2, 2, C.hood); f.px(16, 13, C.face); f.px(16, 14, C.eyeDim);
    f.line(8, 15, 13, 20, C.mantle);
  } else {
    f.ellipse(9, 19, 2.2, 2, C.hood); f.px(9, 20, C.face);
    f.line(10, 12, 16, 17, C.mantle);
  }
  f.row(21, 10, 14, C.boot);
}

function drawLying(c, ox, oy, eye, stage) {
  const f = frame(c, ox, oy);
  for (let y = 17; y <= 21; y++) f.row(y, 6, 19, C.cloak);
  f.row(17, 7, 18, C.cloakLight);
  f.row(21, 6, 19, C.cloakShade);
  for (let y = 17; y <= 21; y++) f.px(9, y, C.mantle), f.px(10, y, C.mantleShade);
  f.row(19, 20, 21, C.boot); f.row(20, 20, 21, C.boot);
  for (let y = 16; y <= 21; y++) f.row(y, 2, 7, C.hood);
  f.row(16, 3, 6, C.hoodLight);
  for (let y = 18; y <= 20; y++) f.row(y, 3, 5, C.face);
  if (eye) f.px(4, 19, eye);
  if (stage >= 2) f.row(21, 2, 21, '#3a0d14'); // dark pool spreading under the body
}

export function buildPlayerSheet() {
  const L = PLAYER_LAYOUT;
  const FW = L.frameWidth;
  const FH = L.frameHeight;
  const sheet = new PixelCanvas(FW * L.columns, FH * 3);
  const dirs = ['down', 'side', 'up'];

  const ATTACK = {
    down: [{ a: -60, h: [17, 12] }, { a: 20, h: [17, 15] }, { a: 110, h: [14, 17] }, { a: 80, h: [16, 16], len: 6 }],
    side: [{ a: -110, h: [13, 11] }, { a: -15, h: [16, 13] }, { a: 35, h: [16, 15] }, { a: 65, h: [15, 15], len: 6 }],
    up: [{ a: -20, h: [17, 11] }, { a: -90, h: [16, 8] }, { a: -160, h: [8, 9] }, { a: -130, h: [9, 10], len: 6 }]
  };
  const ATTACK_BODY = [{ bob: 0, lean: -1 }, { bob: 0, lean: 1 }, { bob: 1, lean: 1 }, { bob: 1, lean: 0 }];
  const CAST_HAND = { down: [17, 8], side: [17, 9], up: [16, 6] };

  dirs.forEach((dir, r) => {
    const oy = r * FH;
    const at = (col) => col * FW;
    // idle
    [{ bob: 0 }, { bob: 0 }, { bob: 1 }, { bob: 1, eye: C.eyeDim }].forEach((o, i) => drawBody(sheet, at(L.idle[i]), oy, dir, o));
    // walk
    [{ bob: 0, legs: 'A', hem: -1 }, { bob: 1 }, { bob: 0, legs: 'B', hem: 1 }, { bob: 1 }]
      .forEach((o, i) => drawBody(sheet, at(L.walk[i]), oy, dir, o));
    // run: longer stride, forward lean, cloak trailing
    const runHem = dir === 'side' ? [-2, -1, -2, -1] : [-1, 1, 1, -1];
    [{ bob: 0, legs: 'A' }, { bob: 1 }, { bob: 0, legs: 'B' }, { bob: 1 }]
      .forEach((o, i) => drawBody(sheet, at(L.run[i]), oy, dir, { ...o, hem: runHem[i], lean: 1, flutter: true }));
    // attack (sword swing; the slash VFX is a separate sprite aimed at the cursor)
    ATTACK[dir].forEach((s, i) => {
      const x = at(L.attack[i]);
      const b = ATTACK_BODY[i];
      if (dir === 'up') drawSword(sheet, x, oy, s.h[0], s.h[1] + b.bob, s.a, s.len);
      drawBody(sheet, x, oy, dir, { ...b, legs: i === 1 ? 'A' : 'N' });
      if (dir !== 'up') drawSword(sheet, x, oy, s.h[0] + (dir === 'side' ? b.lean : 0), s.h[1] + b.bob, s.a, s.len);
    });
    // cast (secondary: arcane bolt)
    L.cast.forEach((col, i) => {
      drawBody(sheet, at(col), oy, dir, { bob: i === 0 ? 0 : 1, eye: '#d8c8ff' });
      drawOrb(sheet, at(col), oy, CAST_HAND[dir][0], CAST_HAND[dir][1] + i, i === 1);
    });
    // dodge roll
    drawBody(sheet, at(L.dodge[0]), oy, dir, { bob: 3 });
    drawRollBall(sheet, at(L.dodge[1]), oy, 0);
    drawRollBall(sheet, at(L.dodge[2]), oy, 1);
    drawBody(sheet, at(L.dodge[3]), oy, dir, { bob: 2 });
    // hit
    drawBody(sheet, at(L.hit[0]), oy, dir, { bob: 1, lean: -1, hem: 1, eye: '#ffffff' });
    // death (same for every facing)
    drawBody(sheet, at(L.death[0]), oy, dir, { bob: 2, eye: C.eyeDim });
    drawBody(sheet, at(L.death[1]), oy, dir, { bob: 4, eye: C.eyeDim });
    drawLying(sheet, at(L.death[2]), oy, C.eyeDim, 0);
    drawLying(sheet, at(L.death[3]), oy, C.eyeOff, 1);
    drawLying(sheet, at(L.death[4]), oy, null, 2);

    for (let i = 0; i < L.columns; i++) sheet.outline(i * FW, oy, FW, FH, OUTLINE);
  });
  return sheet;
}
