import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScale } from '../src/core/PixelScaler.js';

const base = { baseWidth: 480, baseHeight: 270 };

test('1920x1080 @1x -> integer x4, no letterbox', () => {
  const s = computeScale({ ...base, viewportWidth: 1920, viewportHeight: 1080 });
  assert.equal(s.physicalScale, 4);
  assert.equal(s.cssWidth, 1920);
  assert.equal(s.letterboxX, 0);
});

test('1366x768 -> integer x2 with letterbox (never stretched)', () => {
  const s = computeScale({ ...base, viewportWidth: 1366, viewportHeight: 768 });
  assert.equal(s.physicalScale, 2);
  assert.ok(s.integer);
  assert.equal(s.cssWidth, 960);
  assert.equal(s.cssHeight, 540);
  assert.equal(s.letterboxX, 203);
});

test('HiDPI 1280x720 CSS @1.5 dpr -> 1920 physical px -> x4 physical', () => {
  const s = computeScale({ ...base, viewportWidth: 1280, viewportHeight: 720, devicePixelRatio: 1.5 });
  assert.equal(s.physicalScale, 4);
  assert.ok(Math.abs(s.zoom - 4 / 1.5) < 1e-9);
});

test('fit mode uses fractional uniform scale', () => {
  const s = computeScale({ ...base, viewportWidth: 1366, viewportHeight: 768, mode: 'fit' });
  assert.ok(Math.abs(s.physicalScale - 768 / 270) < 1e-9);
  assert.ok(!s.integer);
});

test('window smaller than 480x270 falls back to fractional shrink', () => {
  const s = computeScale({ ...base, viewportWidth: 400, viewportHeight: 300 });
  assert.ok(s.physicalScale < 1);
  assert.ok(s.cssWidth <= 400);
});

test('aspect ratio always 16:9', () => {
  for (const [w, h] of [[800, 600], [2560, 1080], [1024, 1366], [3840, 2160]]) {
    const s = computeScale({ ...base, viewportWidth: w, viewportHeight: h });
    assert.ok(Math.abs(s.cssWidth / s.cssHeight - 16 / 9) < 1e-9);
    assert.ok(s.cssWidth <= w + 1e-9 && s.cssHeight <= h + 1e-9);
  }
});
