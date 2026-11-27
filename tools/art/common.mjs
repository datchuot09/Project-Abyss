// Shared drawing helpers for the placeholder art modules.
export const OUTLINE = '#07060b';

export function line(c, x0, y0, x1, y1, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    c.set(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), color);
  }
}

/** Thick line (2px) – reads well for limbs at 24px sprites. */
export function limb(c, x0, y0, x1, y1, color, shade) {
  line(c, x0, y0 + 1, x1, y1 + 1, shade ?? color);
  line(c, x0, y0, x1, y1, color);
}

export function fillEllipse(c, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.35);
      const dy = (y - cy) / (ry + 0.35);
      if (dx * dx + dy * dy <= 1) c.set(x, y, color);
    }
  }
}

/** Ellipse with top-left highlight and bottom-right shade. */
export function shadedEllipse(c, cx, cy, rx, ry, base, light, shade) {
  fillEllipse(c, cx, cy, rx, ry, base);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.35);
      const dy = (y - cy) / (ry + 0.35);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (dx + dy > 0.75 && d > 0.45) c.set(x, y, shade);
      else if (dx + dy < -0.8 && d > 0.35) c.set(x, y, light);
    }
  }
}

export function row(c, y, x0, x1, color) {
  for (let x = x0; x <= x1; x++) c.set(x, y, color);
}

/** Helper bound to a frame origin so drawing code uses local coordinates. */
export function frame(c, ox, oy) {
  return {
    px: (x, y, col) => c.set(ox + x, oy + y, col),
    row: (y, x0, x1, col) => row(c, oy + y, ox + x0, ox + x1, col),
    rect: (x, y, w, h, col) => c.rect(ox + x, oy + y, w, h, col),
    line: (x0, y0, x1, y1, col) => line(c, ox + x0, oy + y0, ox + x1, oy + y1, col),
    limb: (x0, y0, x1, y1, col, shade) => limb(c, ox + x0, oy + y0, ox + x1, oy + y1, col, shade),
    ellipse: (cx, cy, rx, ry, col) => fillEllipse(c, ox + cx, oy + cy, rx, ry, col),
    shaded: (cx, cy, rx, ry, base, light, shade) => shadedEllipse(c, ox + cx, oy + cy, rx, ry, base, light, shade)
  };
}
