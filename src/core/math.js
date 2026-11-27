// Pure math helpers (no Phaser import) – covered by unit tests.

/** Normalises a movement vector so diagonals are not faster, with a radial deadzone. */
export function normalizeMove(x, y, deadzone = 0) {
  const len = Math.hypot(x, y);
  if (len === 0 || len <= deadzone) return { x: 0, y: 0 };
  const capped = Math.min(1, len);
  // Analog input ramps from 0 at the deadzone edge to 1 at full tilt.
  const mag = deadzone > 0 ? (capped - deadzone) / (1 - deadzone) : capped;
  return { x: (x / len) * mag, y: (y / len) * mag };
}

/** Frame-rate independent exponential approach factor. */
export function approachFactor(rate, dtSeconds) {
  return 1 - Math.exp(-rate * dtSeconds);
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Parses Tiled colour strings (#RRGGBB or #AARRGGBB) to a 0xRRGGBB number. */
export function parseTiledColor(value, fallback = 0xffffff) {
  if (typeof value !== 'string') return fallback;
  const hex = value.replace('#', '');
  if (hex.length === 8) return parseInt(hex.slice(2), 16);
  if (hex.length === 6) return parseInt(hex, 16);
  return fallback;
}
