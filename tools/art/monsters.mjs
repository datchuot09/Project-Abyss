// Monster sprite sheets. All face right (flipX for left), single row.
// Columns: idle 0-3, walk 4-7, attack 8-11, hit 12, death 13-17.
import { PixelCanvas } from '../lib/png.mjs';
import { OUTLINE, frame } from './common.mjs';

export const MONSTER_LAYOUT = {
  columns: 18,
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7],
  attack: [8, 9, 10, 11],
  hit: [12],
  death: [13, 14, 15, 16, 17]
};

function sheetFor(size, draw) {
  const L = MONSTER_LAYOUT;
  const c = new PixelCanvas(size * L.columns, size);
  for (let i = 0; i < L.columns; i++) {
    draw(c, i * size, i);
    c.outline(i * size, 0, size, size, OUTLINE);
  }
  return c;
}

// ------------------------------------------------------------------- Ghoul
const G = {
  skin: '#7e8f6e', shade: '#56634a', light: '#a3b38f', rag: '#3b2f2a', ragLight: '#55443b',
  eye: '#ff5a4a', claw: '#e8e0c8', mouth: '#2a1414', blood: '#5a0f16', bone: '#cfc6b0'
};

function ghoulBody(c, ox, o) {
  const { bob = 0, legs = 'N', lean = 0, arm = 'idle', eye = G.eye } = o;
  const f = frame(c, ox, 0);
  const T = bob;
  const legX = { N: [8, 13], A: [7, 14], B: [9, 12] }[legs];
  for (const lx of legX) { f.rect(lx, 18, 2, 3, G.shade); f.row(21, lx, lx + 2, G.skin); }
  // back arm (behind body)
  f.limb(10 + lean, T + 12, 8 + lean, T + 16, G.shade);
  // torso, hunched
  f.shaded(11 + lean, T + 14, 5, 4, G.skin, G.light, G.shade);
  f.row(T + 10, 8 + lean, 12 + lean, G.shade);
  for (let y = 16; y <= 18; y++) f.row(T + y, 7 + lean, 15 + lean, y === 16 ? G.ragLight : G.rag);
  f.px(8 + lean, T + 19, G.rag); f.px(12 + lean, T + 19, G.rag); f.px(14 + lean, T + 19, G.rag);
  // head
  const hx = 14 + lean;
  f.shaded(hx + 2, T + 11, 2.6, 2.4, G.skin, G.light, G.shade);
  f.row(T + 13, hx + 1, hx + 4, G.mouth);
  f.px(hx + 2, T + 13, G.claw); f.px(hx + 4, T + 13, G.claw);
  f.px(hx + 3, T + 10, eye);
  // front arm
  const shoulder = [13 + lean, T + 12];
  const hand = {
    idle: [17 + lean, T + 17],
    raise: [15 + lean, T + 5],
    reach: [21 + lean, T + 13],
    strike: [20 + lean, T + 18]
  }[arm];
  f.limb(shoulder[0], shoulder[1], hand[0], hand[1], G.skin, G.shade);
  f.px(hand[0] + 1, hand[1], G.claw); f.px(hand[0] + 1, hand[1] + 1, G.claw); f.px(hand[0], hand[1] + 2, G.claw);
}

function ghoulFallen(c, ox, stage) {
  const f = frame(c, ox, 0);
  if (stage <= 1) {
    f.ellipse(12, 19, 7, 2.6, G.skin);
    f.row(17, 6, 16, G.light);
    f.ellipse(19, 19, 2.4, 2, G.skin);
    f.px(20, 18, stage === 0 ? G.eye : G.mouth);
    for (let x = 7; x <= 15; x++) f.px(x, 21, G.rag);
    f.row(21, 4, 21, G.blood);
  } else {
    f.ellipse(12, 20, 8 - stage, 1.6, G.blood);
    f.line(8, 19, 13, 18, G.bone); f.line(11, 20, 16, 20, G.bone); f.px(17, 19, G.bone);
  }
}

export function buildGhoul() {
  const L = MONSTER_LAYOUT;
  return sheetFor(24, (c, ox, i) => {
    if (L.idle.includes(i)) return ghoulBody(c, ox, { bob: [0, 0, 1, 1][i] });
    if (L.walk.includes(i)) { const k = i - 4; return ghoulBody(c, ox, { bob: k % 2, legs: ['A', 'N', 'B', 'N'][k] }); }
    if (L.attack.includes(i)) {
      const k = i - 8;
      return ghoulBody(c, ox, [
        { lean: -2, arm: 'raise', bob: 1 },
        { lean: 2, arm: 'reach', legs: 'A' },
        { lean: 2, arm: 'strike', legs: 'A', bob: 1 },
        { lean: 0, arm: 'idle', bob: 1 }
      ][k]);
    }
    if (i === L.hit[0]) return ghoulBody(c, ox, { lean: -2, arm: 'raise', eye: '#ffffff' });
    const k = i - 13;
    if (k === 0) return ghoulBody(c, ox, { lean: -2, bob: 2, arm: 'raise', eye: '#a03030' });
    return ghoulFallen(c, ox, k - 1);
  });
}

// ------------------------------------------------------------- Bone Archer
const B = {
  bone: '#d9d2bd', shade: '#9a927d', dark: '#3a3530', cape: '#3d2545', capeLight: '#5a3a63',
  eye: '#ffd24a', wood: '#7a5230', woodDark: '#4e331d', string: '#c8c0a8', arrowHead: '#9aa3b5'
};

function archerBody(c, ox, o) {
  const { bob = 0, legs = 'N', lean = 0, draw = 0, arrow = false, eye = B.eye, bowShake = 0 } = o;
  const f = frame(c, ox, 0);
  const T = bob;
  // tattered cape
  for (let y = 4; y <= 15; y++) f.row(T + y, 6 + lean, 8 + lean, y % 3 === 0 ? B.capeLight : B.cape);
  f.px(6 + lean, T + 16, B.cape); f.px(8 + lean, T + 17, B.cape);
  // legs
  const lx = { N: [10, 13], A: [9, 14], B: [11, 12] }[legs];
  f.line(11, T + 16, lx[0], 20, B.shade); f.line(12, T + 16, lx[1], 20, B.bone);
  f.row(21, lx[0] - 1, lx[0], B.shade); f.row(21, lx[1], lx[1] + 1, B.bone);
  // pelvis, spine, ribs
  f.row(T + 15, 10 + lean, 13 + lean, B.bone);
  for (let y = 9; y <= 14; y++) f.px(11 + lean, T + y, B.shade);
  for (const y of [10, 12]) f.row(T + y, 9 + lean, 13 + lean, B.bone);
  for (const y of [11, 13]) { f.px(9 + lean, T + y, B.dark); f.px(13 + lean, T + y, B.dark); }
  // skull
  f.shaded(12 + lean, T + 5, 2.8, 2.6, B.bone, '#f4efe0', B.shade);
  f.px(13 + lean, T + 5, B.dark); f.px(14 + lean, T + 5, eye);
  f.row(T + 8, 11 + lean, 14 + lean, B.shade); f.px(12 + lean, T + 8, B.dark);
  // bow arm
  const grip = [18 + bowShake, T + 12];
  f.line(12 + lean, T + 10, grip[0], grip[1], B.bone);
  // bow (arc) + string
  const top = [17 + bowShake, T + 5];
  const bot = [17 + bowShake, T + 19];
  for (let y = top[1]; y <= bot[1]; y++) {
    const t = (y - top[1]) / (bot[1] - top[1]);
    const bulge = Math.round(Math.sin(t * Math.PI) * 2);
    f.px(top[0] + bulge, y, y % 2 ? B.wood : B.woodDark);
  }
  const sx = 17 + bowShake - draw;
  f.line(top[0], top[1], sx, T + 12, B.string);
  f.line(bot[0], bot[1], sx, T + 12, B.string);
  if (draw > 0) f.line(12 + lean, T + 11, sx, T + 12, B.bone); // drawing arm
  if (arrow) {
    f.line(sx, T + 12, 21 + bowShake, T + 12, B.wood);
    f.px(22 + bowShake, T + 12, B.arrowHead); f.px(21 + bowShake, T + 11, B.arrowHead); f.px(21 + bowShake, T + 13, B.arrowHead);
  }
}

function archerPile(c, ox, stage) {
  const f = frame(c, ox, 0);
  f.ellipse(12, 20, 7, 1.5, B.cape);
  f.line(6, 19, 11, 20, B.bone); f.line(13, 19, 18, 20, B.shade); f.line(9, 18, 15, 18, B.bone);
  f.shaded(stage === 0 ? 16 : 17, 18, 2.2, 2, B.bone, '#f4efe0', B.shade);
  if (stage === 0) f.px(17, 18, '#8a6a20');
  f.line(19, 13, 21, 20, B.wood);
}

export function buildBoneArcher() {
  const L = MONSTER_LAYOUT;
  return sheetFor(24, (c, ox, i) => {
    if (L.idle.includes(i)) return archerBody(c, ox, { bob: [0, 0, 1, 1][i] });
    if (L.walk.includes(i)) { const k = i - 4; return archerBody(c, ox, { bob: k % 2, legs: ['A', 'N', 'B', 'N'][k] }); }
    if (L.attack.includes(i)) {
      const k = i - 8;
      return archerBody(c, ox, [
        { draw: 1, arrow: true },
        { draw: 4, arrow: true, lean: -1 },
        { draw: 0, bowShake: 1 },
        { draw: 0 }
      ][k]);
    }
    if (i === L.hit[0]) return archerBody(c, ox, { lean: -1, eye: '#ffffff', bob: 1 });
    const k = i - 13;
    if (k === 0) return archerBody(c, ox, { lean: -2, bob: 2, eye: '#8a6a20' });
    return archerPile(c, ox, k - 1);
  });
}

// --------------------------------------------------------------- Abyss Mite
const M = {
  body: '#3a2450', shade: '#24152f', light: '#5a3a78', eye: '#ff3df0', eyeCore: '#ffd6fb', leg: '#1a1020',
  goo: '#2a1238', gooLight: '#55246e'
};

function miteBody(c, ox, o) {
  const { dy = 0, legPhase = 0, rx = 4, ry = 3, dx = 0, eyeBig = false, eye = M.eye, spread = 0 } = o;
  const f = frame(c, ox, 0);
  const cx = 7 + dx;
  const cy = 10 + dy;
  const lift = (k) => ((k + legPhase) % 2 === 0 ? 0 : -1);
  for (let k = 0; k < 3; k++) {
    const by = cy - 1 + k;
    f.line(cx - 2, by, cx - 5 - spread, by - 1 + k + lift(k), M.leg);
    f.line(cx - 5 - spread, by - 1 + k + lift(k), cx - 6 - spread, by + 1 + k, M.leg);
    f.line(cx + 2, by, cx + 5 + spread, by - 1 + k + lift(k + 1), M.leg);
    f.line(cx + 5 + spread, by - 1 + k + lift(k + 1), cx + 6 + spread, by + 1 + k, M.leg);
  }
  f.shaded(cx, cy, rx, ry, M.body, M.light, M.shade);
  f.px(cx + rx, cy + 1, M.leg); f.px(cx + rx + 1, cy + 2, M.leg); // mandible
  if (eyeBig) { f.rect(cx + 1, cy - 2, 2, 2, eye); f.px(cx + 3, cy - 1, eye); f.px(cx + 1, cy - 2, M.eyeCore); }
  else { f.px(cx + 2, cy - 1, eye); f.px(cx + 1, cy - 1, eye); }
}

function miteSplat(c, ox, stage) {
  const f = frame(c, ox, 0);
  const r = [4.5, 5.5, 5.5, 5][stage];
  f.ellipse(8, 12, r, r * 0.45, M.goo);
  if (stage < 3) f.ellipse(7, 11.5, r * 0.5, 1, M.gooLight);
  if (stage < 2) { f.px(9, 11, M.eye); f.px(4, 12, M.eye); }
}

export function buildAbyssMite() {
  const L = MONSTER_LAYOUT;
  return sheetFor(16, (c, ox, i) => {
    if (L.idle.includes(i)) return miteBody(c, ox, { legPhase: i % 2, dy: i >= 2 ? 1 : 0 });
    if (L.walk.includes(i)) { const k = i - 4; return miteBody(c, ox, { legPhase: k % 2, spread: k % 2, dy: k % 2 }); }
    if (L.attack.includes(i)) {
      const k = i - 8;
      return miteBody(c, ox, [
        { dy: 1, spread: 1, rx: 4.5, ry: 2.6 },
        { dy: 1, spread: 1, eyeBig: true },
        { rx: 5.5, ry: 2.2, dx: 1, eyeBig: true, spread: -1 },
        { legPhase: 1 }
      ][k]);
    }
    if (i === L.hit[0]) return miteBody(c, ox, { eye: '#ffffff', eyeBig: true, dy: -1 });
    const k = i - 13;
    if (k === 0) return miteBody(c, ox, { rx: 3, ry: 2, dy: 1, eye: '#a02090', spread: 1 });
    return miteSplat(c, ox, k - 1);
  });
}
