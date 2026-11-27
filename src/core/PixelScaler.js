// Pure resolution maths for pixel-perfect output (unit tested).
//
// The game renders at a fixed logical resolution. We pick a scale so every
// logical pixel maps to a whole number of *physical* device pixels (taking
// devicePixelRatio into account). Leftover space becomes letterbox bars,
// the image is never stretched non-uniformly.

/**
 * @param {object} o
 * @param {number} o.viewportWidth   available CSS width
 * @param {number} o.viewportHeight  available CSS height
 * @param {number} o.baseWidth       logical width (480)
 * @param {number} o.baseHeight      logical height (270)
 * @param {number} [o.devicePixelRatio=1]
 * @param {'integer'|'fit'} [o.mode='integer']
 */
export function computeScale({ viewportWidth, viewportHeight, baseWidth, baseHeight, devicePixelRatio = 1, mode = 'integer' }) {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const physW = Math.max(1, viewportWidth * dpr);
  const physH = Math.max(1, viewportHeight * dpr);
  const fit = Math.min(physW / baseWidth, physH / baseHeight);

  let physicalScale;
  if (mode === 'integer' && fit >= 1) {
    physicalScale = Math.floor(fit + 1e-6);
  } else {
    // 'fit' mode, or the window is smaller than 1x: uniform fractional scale.
    physicalScale = fit;
  }

  const zoom = physicalScale / dpr; // CSS zoom handed to Phaser
  return {
    zoom,
    physicalScale,
    integer: Number.isInteger(physicalScale),
    cssWidth: baseWidth * zoom,
    cssHeight: baseHeight * zoom,
    letterboxX: Math.max(0, (viewportWidth - baseWidth * zoom) / 2),
    letterboxY: Math.max(0, (viewportHeight - baseHeight * zoom) / 2)
  };
}
