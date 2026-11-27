// UI art: skill/buff icons, AOE textures, exhaustion screen overlays.
import { PixelCanvas, mulberry32 as mulberry } from '../lib/png.mjs';
import { OUTLINE, frame } from './common.mjs';

// Icon index map (must match "icon" fields in data/characters + data/progression/buffs.json)
export const ICONS = [
  'rune_rush', 'frost_sigil', 'abyssal_eclipse', 'arcane_bolt', 'dodge',
  'physical_damage', 'magic_damage', 'max_hp', 'attack_speed', 'move_speed',
  'crit_rate', 'cooldown', 'healing', 'skill_damage'
];

const DRAW = {
  rune_rush(f) {
    f.line(3, 11, 12, 4, '#8fd8ff'); f.line(4, 12, 13, 5, '#dff6ff');
    f.line(10, 3, 13, 4, '#dff6ff'); f.line(12, 3, 12, 7, '#dff6ff');
    f.line(1, 8, 5, 8, '#4a7fb0'); f.line(2, 13, 6, 13, '#4a7fb0'); f.line(0, 10, 3, 10, '#4a7fb0');
  },
  frost_sigil(f) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) f.line(8 - dx * 6, 8 - dy * 6, 8 + dx * 6, 8 + dy * 6, '#bfefff');
    f.ellipse(8, 8, 2, 2, '#ffffff');
    for (const [x, y] of [[2, 8], [14, 8], [8, 2], [8, 14]]) f.px(x, y, '#5fb8f0');
  },
  abyssal_eclipse(f) {
    f.ellipse(8, 8, 6.5, 6.5, '#7a3cc8');
    f.ellipse(8, 8, 5.5, 5.5, '#b48cff');
    f.ellipse(9, 7, 5, 5, '#07060b');
    f.px(3, 3, '#e6dcff'); f.px(13, 12, '#e6dcff');
  },
  arcane_bolt(f) {
    f.ellipse(8, 8, 5, 5, '#6a4fd0'); f.ellipse(8, 8, 3.5, 3.5, '#b99cff'); f.ellipse(8, 8, 1.5, 1.5, '#ffffff');
    f.line(1, 14, 4, 11, '#9a7cff');
  },
  dodge(f) {
    for (let a = 0.6; a < 5.6; a += 0.12) f.px(Math.round(8 + Math.cos(a) * 5), Math.round(8 + Math.sin(a) * 5), '#8ff0ff');
    f.line(11, 2, 13, 5, '#dff6ff'); f.line(13, 5, 10, 6, '#dff6ff');
    f.ellipse(8, 8, 1.5, 1.5, '#2c3a5c');
  },
  physical_damage(f) {
    f.line(3, 13, 12, 4, '#dfe6f2'); f.line(4, 13, 13, 4, '#8f99ad');
    f.line(3, 10, 6, 13, '#c8a052'); f.px(2, 14, '#c8a052');
  },
  magic_damage(f) {
    f.line(8, 1, 8, 15, '#b99cff'); f.line(1, 8, 15, 8, '#b99cff');
    f.line(4, 4, 12, 12, '#6a4fd0'); f.line(12, 4, 4, 12, '#6a4fd0');
    f.ellipse(8, 8, 2, 2, '#ffffff');
  },
  max_hp(f) {
    f.ellipse(5.5, 6, 3, 3, '#d9455f'); f.ellipse(10.5, 6, 3, 3, '#d9455f');
    for (let y = 7; y <= 13; y++) f.row(y, 3 + (y - 7), 13 - (y - 7), '#d9455f');
    f.px(5, 5, '#ff9aa8'); f.px(4, 6, '#ff9aa8');
  },
  attack_speed(f) {
    for (const x of [2, 7]) { f.line(x, 3, x + 5, 8, '#ffd24a'); f.line(x + 5, 8, x, 13, '#ffd24a'); }
  },
  move_speed(f) {
    f.rect(5, 4, 4, 7, '#6a8f4a'); f.rect(5, 10, 8, 3, '#6a8f4a'); f.row(13, 4, 13, '#3d5a2a');
    f.line(1, 6, 3, 6, '#cfe6b0'); f.line(0, 9, 3, 9, '#cfe6b0'); f.line(1, 12, 3, 12, '#cfe6b0');
  },
  crit_rate(f) {
    for (let a = 0; a < Math.PI * 2; a += 0.2) f.px(Math.round(8 + Math.cos(a) * 6), Math.round(8 + Math.sin(a) * 6), '#ff6a5a');
    f.line(8, 0, 8, 4, '#ff6a5a'); f.line(8, 12, 8, 15, '#ff6a5a'); f.line(0, 8, 4, 8, '#ff6a5a'); f.line(12, 8, 15, 8, '#ff6a5a');
    f.ellipse(8, 8, 1.2, 1.2, '#ffd24a');
  },
  cooldown(f) {
    f.row(2, 3, 12, '#c8a052'); f.row(13, 3, 12, '#c8a052');
    for (let y = 3; y <= 7; y++) f.row(y, 4 + (y - 3), 11 - (y - 3), '#8fd8ff');
    for (let y = 8; y <= 12; y++) f.row(y, 7 - (y - 8), 8 + (y - 8), y > 10 ? '#8fd8ff' : '#2a4a60');
  },
  healing(f) {
    f.rect(6, 2, 4, 12, '#7fd650'); f.rect(2, 6, 12, 4, '#7fd650');
    f.rect(7, 3, 2, 10, '#c8f5a8'); f.rect(3, 7, 10, 2, '#c8f5a8');
  },
  skill_damage(f) {
    f.rect(3, 2, 10, 12, '#5a3a20'); f.rect(4, 3, 8, 10, '#7a5230');
    f.line(6, 5, 10, 5, '#ffd24a'); f.line(8, 5, 8, 11, '#ffd24a'); f.line(6, 9, 10, 9, '#ffd24a');
  }
};

export function buildIcons() {
  const cols = 8;
  const c = new PixelCanvas(16 * cols, 16 * Math.ceil(ICONS.length / cols));
  ICONS.forEach((id, i) => {
    const ox = (i % cols) * 16;
    const oy = Math.floor(i / cols) * 16;
    DRAW[id](frame(c, ox, oy));
    c.outline(ox, oy, 16, 16, OUTLINE);
  });
  return c;
}

/** White 2px ring (tinted + scaled at runtime for AOE telegraphs/blasts). */
export function buildRing() {
  const S = 64;
  const c = new PixelCanvas(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2);
    if (d <= 31 && d >= 28) c.set(x, y, d > 30 ? '#ffffff' : '#ffffffaa');
  }
  return c;
}

/** Rune circle drawn on the floor where Frost Sigil will detonate. */
export function buildSigil() {
  const S = 48;
  const c = new PixelCanvas(S, S);
  const f = frame(c, 0, 0);
  for (let a = 0; a < Math.PI * 2; a += 0.03) {
    f.px(Math.round(24 + Math.cos(a) * 22), Math.round(24 + Math.sin(a) * 22), '#ffffff');
    f.px(Math.round(24 + Math.cos(a) * 15), Math.round(24 + Math.sin(a) * 15), '#ffffffaa');
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    f.line(Math.round(24 + Math.cos(a) * 15), Math.round(24 + Math.sin(a) * 15), Math.round(24 + Math.cos(a + 2.1) * 15), Math.round(24 + Math.sin(a + 2.1) * 15), '#ffffffcc');
    f.px(Math.round(24 + Math.cos(a) * 19), Math.round(24 + Math.sin(a) * 19), '#ffffff');
  }
  return c;
}

/** Cracks growing from the four screen corners (stamina <= -100). */
export function buildScreenCracks(W = 480, H = 270) {
  const c = new PixelCanvas(W, H);
  const rng = mulberry(9001);
  const crack = (x, y, dx, dy, len, depth) => {
    for (let i = 0; i < len; i++) {
      c.set(Math.round(x), Math.round(y), i < len * 0.6 ? '#e8e0f0dd' : '#e8e0f088');
      c.set(Math.round(x) + 1, Math.round(y), '#00000088');
      x += dx + (rng() - 0.5) * 0.9;
      y += dy + (rng() - 0.5) * 0.9;
      if (depth > 0 && rng() < 0.06) crack(x, y, dx + (rng() - 0.5), dy + (rng() - 0.5), len * 0.5, depth - 1);
    }
  };
  for (const [x, y, sx, sy] of [[0, 0, 1, 1], [W - 1, 0, -1, 1], [0, H - 1, 1, -1], [W - 1, H - 1, -1, -1]]) {
    for (let k = 0; k < 3; k++) {
      const a = 0.25 + k * 0.45 + rng() * 0.2;
      crack(x, y, Math.cos(a) * sx, Math.sin(a) * sy, 55 + rng() * 40, 2);
    }
  }
  return c;
}

/** Banded red vignette concentrated in the corners. */
export function buildVignetteRed(W = 480, H = 270) {
  const c = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = Math.min(x, W - 1 - x) / (W / 2);
    const dy = Math.min(y, H - 1 - y) / (H / 2);
    const corner = 1 - Math.min(1, Math.hypot(1 - dx, 1 - dy) / 1.414);
    const t = Math.max(0, 1 - Math.min(dx, dy) * 3.2) * (1 - corner * 0.2);
    const band = Math.floor(t * 5) / 5;
    if (band <= 0) continue;
    c.set(x, y, [170, 10, 24, Math.round(band * band * 200)]);
  }
  return c;
}
