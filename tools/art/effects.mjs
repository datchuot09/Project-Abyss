// Combat VFX sprites: slash arcs, projectiles, hit sparks, shadows, cursor.
import { PixelCanvas } from '../lib/png.mjs';
import { OUTLINE, frame } from './common.mjs';

/** Crescent slash facing right (0 rad). 4 frames of 32x32. Drawn white, tinted at runtime. */
export function buildSlash() {
  const S = 32;
  const c = new PixelCanvas(S * 4, S);
  const stages = [
    { from: -70, to: -10, r0: 9, r1: 12, col: '#ffffff' },
    { from: -70, to: 70, r0: 8, r1: 14, col: '#ffffff' },
    { from: -20, to: 75, r0: 10, r1: 14, col: '#cfe6ff' },
    { from: 30, to: 80, r0: 12, r1: 14, col: '#8fb4e0', sparse: true }
  ];
  stages.forEach((s, i) => {
    const ox = i * S;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - S / 2;
        const dy = y + 0.5 - S / 2;
        const r = Math.hypot(dx, dy);
        const a = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (a < s.from || a > s.to) continue;
        // crescent: thicker in the middle of the arc
        const t = (a - s.from) / (s.to - s.from);
        const thick = Math.sin(t * Math.PI);
        const inner = s.r1 - (s.r1 - s.r0) * thick;
        if (r < inner || r > s.r1) continue;
        if (s.sparse && (x + y) % 2) continue;
        const edge = r > s.r1 - 1;
        c.set(ox + x, y, edge ? '#ffffff' : s.col);
      }
    }
  });
  return c;
}

export function buildArcaneBolt() {
  const S = 10;
  const c = new PixelCanvas(S * 4, S);
  for (let i = 0; i < 4; i++) {
    const f = frame(c, i * S, 0);
    const r = i % 2 ? 3.6 : 3.1;
    f.ellipse(5, 5, r, r, '#6a4fd0');
    f.ellipse(5, 5, r - 1, r - 1, '#b99cff');
    f.ellipse(5, 5, 1, 1, '#ffffff');
    const spark = [[1, 5], [5, 1], [9, 5], [5, 9]][i];
    f.px(spark[0], spark[1], '#e6dcff');
  }
  return c;
}

export function buildArrow() {
  const c = new PixelCanvas(12, 5);
  const f = frame(c, 0, 0);
  f.row(2, 2, 9, '#7a5230');
  f.px(10, 2, '#c7cede'); f.px(11, 2, '#9aa3b5'); f.px(9, 1, '#9aa3b5'); f.px(9, 3, '#9aa3b5');
  f.px(0, 1, '#d9d2bd'); f.px(1, 1, '#d9d2bd'); f.px(0, 3, '#d9d2bd'); f.px(1, 3, '#d9d2bd');
  c.outline(0, 0, 12, 5, OUTLINE);
  return c;
}

export function buildHitSpark() {
  const S = 16;
  const c = new PixelCanvas(S * 4, S);
  const rays = 8;
  for (let i = 0; i < 4; i++) {
    const f = frame(c, i * S, 0);
    const r0 = [0, 2, 4, 6][i];
    const r1 = [3, 6, 7, 7][i];
    for (let k = 0; k < rays; k++) {
      const a = (k / rays) * Math.PI * 2 + (k % 2 ? 0.2 : 0);
      const len = k % 2 ? r1 - 1 : r1;
      for (let r = r0; r <= len; r++) f.px(Math.round(8 + Math.cos(a) * r), Math.round(8 + Math.sin(a) * r), r === len ? '#ffe08a' : '#ffffff');
    }
    if (i === 0) f.ellipse(8, 8, 2, 2, '#ffffff');
  }
  return c;
}

export function buildShadow() {
  const c = new PixelCanvas(14, 5);
  frame(c, 0, 0).ellipse(7, 2, 6, 2, '#00000066');
  return c;
}

export function buildCrosshair() {
  const c = new PixelCanvas(11, 11);
  const f = frame(c, 0, 0);
  const col = '#f2e6c8';
  for (const [x, y] of [[0, 0], [10, 0], [0, 10], [10, 10]]) {
    const sx = x ? -1 : 1;
    const sy = y ? -1 : 1;
    f.px(x, y, col); f.px(x + sx, y, col); f.px(x, y + sy, col);
  }
  f.px(5, 5, '#ff6a5a');
  c.outline(0, 0, 11, 11, OUTLINE);
  return c;
}
