#!/usr/bin/env node
// End-to-end smoke test in a real Chromium (Playwright).
//   npm run smoke            -> against the Vite dev server
//   npm run smoke -- --prod  -> against the production build (run `npm run build` first)
//   add --shots <dir>        -> save screenshots
import { createServer, preview } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROD = process.argv.includes('--prod');
const shotsIdx = process.argv.indexOf('--shots');
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// Playwright is not a project dependency (keeps installs small). Resolve it
// from the project or from a global install; explain how to get it otherwise.
let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('Playwright not found. Install it with:\n  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const server = PROD
  ? await preview({ preview: { port: 4173, strictPort: false }, logLevel: 'silent' })
  : await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'silent' });
if (!PROD) await server.listen();
const base = (server.resolvedUrls?.local?.[0] ?? 'http://localhost:5199/') + (PROD ? '?debug' : '');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const consoleProblems = [];
// Headless Chromium's software GL driver logs this once per image texture
// uploaded to WebGL (reproduced with a bare WebGL page, no Phaser). It is an
// artefact of the test environment, not of game code, and never repeats per frame.
const HARNESS_NOISE = /GL Driver Message .*GPU stall due to ReadPixels/;
let harnessNoise = 0;
page.on('console', (m) => {
  if (m.type() !== 'error' && m.type() !== 'warning') return;
  if (HARNESS_NOISE.test(m.text())) harnessNoise++;
  else consoleProblems.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => consoleProblems.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => consoleProblems.push(`[requestfailed] ${r.url()}`));

const shot = async (name) => SHOTS && page.screenshot({ path: join(SHOTS, `${name}.png`) });
const sceneActive = (key) => page.waitForFunction((k) => window.__ABYSS__?.game.scene.isActive(k), key, { timeout: 15000 });
const canvasSize = () => page.evaluate(() => {
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  return { w: r.width, h: r.height, x: r.left, y: r.top, bw: c.width, bh: c.height };
});
const playerState = () => page.evaluate(() => {
  const s = window.__ABYSS__.game.scene.getScene('DungeonScene');
  const p = s.player;
  const cam = s.cameras.main;
  return {
    x: p.x, y: p.y,
    walkable: s.dungeon.isWalkableWorld(p.body.center.x, p.body.center.y),
    inView: p.x >= cam.worldView.x && p.x <= cam.worldView.right && p.y >= cam.worldView.y && p.y <= cam.worldView.bottom,
    scrollX: cam.scrollX, scrollY: cam.scrollY,
    anim: p.anims.currentAnim?.key
  };
});
const hold = async (keys, ms) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
};

try {
  await page.goto(base);
  await sceneActive('MainMenuScene');
  check('Boot -> Preload -> MainMenu', true);
  const renderer = await page.evaluate(() => (window.__ABYSS__.game.renderer.type === 1 ? 'Canvas' : 'WebGL'));
  check('Renderer initialised', true, renderer);
  await page.waitForTimeout(400);
  await shot('01-main-menu');

  let c = await canvasSize();
  check('Logical resolution 480x270', c.bw === 480 && c.bh === 270, `${c.bw}x${c.bh}`);
  check('1366x768 -> integer x2 + letterbox', c.w === 960 && c.h === 540, `${c.w}x${c.h} at (${c.x},${c.y})`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(250);
  c = await canvasSize();
  check('1920x1080 -> integer x4', c.w === 1920 && c.h === 1080, `${c.w}x${c.h}`);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(250);
  c = await canvasSize();
  check('1280x720 -> integer x2 (no stretching)', c.w === 960 && c.h === 540, `${c.w}x${c.h}`);
  const smoothing = await page.evaluate(() => getComputedStyle(document.querySelector('canvas')).imageRendering);
  check('Nearest-neighbour canvas scaling', /pixelated|crisp-edges/.test(smoothing), smoothing);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(250);

  // Menu: toggle scaling via keyboard, then back
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const fitMode = await page.evaluate(() => window.__ABYSS__.services.display.state.mode);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const intMode = await page.evaluate(() => window.__ABYSS__.services.display.state.mode);
  check('Menu "Scaling" option switches mode (rapid key presses)', fitMode === 'fit' && intMode === 'integer', `${fitMode} -> ${intMode}`);
  await page.keyboard.press('ArrowUp');

  // Fullscreen: F11 hotkey (needs a real user-gesture path through InputManager)
  const isFs = () => page.evaluate(() => Boolean(document.fullscreenElement));
  await page.keyboard.press('F11');
  await page.waitForTimeout(300);
  const fsOn = await isFs();
  await page.keyboard.press('F11');
  await page.waitForTimeout(300);
  const fsOff = await isFs();
  check('F11 toggles fullscreen on and off', fsOn && !fsOff);

  // Start the run -> LoadingScene -> DungeonScene
  const listenersBefore = await page.evaluate(() => window.__ABYSS__.EventBus.eventNames().map((n) => `${n}:${window.__ABYSS__.EventBus.listenerCount(n)}`).join(','));
  await page.keyboard.press('Enter');
  await sceneActive('LoadingScene');
  await page.waitForTimeout(450);
  await shot('02-loading');
  check('Loading screen shown between menu and floor', true);
  await sceneActive('DungeonScene');
  await page.waitForTimeout(700);
  await shot('03-dungeon');
  const validation = await page.evaluate(() => window.__ABYSS__.game.scene.getScene('DungeonScene').dungeon.validation);
  check('Tilemap validation (spawns walkable + reachable)', validation.ok && validation.warnings.length === 0, `${validation.reachable}/${validation.walkable} tiles reachable`);

  const start = await playerState();
  check('Player spawned on walkable tile', start.walkable, `(${start.x.toFixed(1)}, ${start.y.toFixed(1)})`);
  check('Camera shows player at spawn', start.inView);

  await hold(['KeyD'], 700);
  const afterRight = await playerState();
  check('D moves right', afterRight.x - start.x > 30, `dx=${(afterRight.x - start.x).toFixed(1)}`);
  await page.waitForTimeout(200);
  const settled = await playerState();
  check('Walk anim while moving -> idle after stop', settled.anim?.includes('idle'), settled.anim);

  // Walk into the north wall for a long time: must be blocked, not stuck inside it
  await hold(['KeyW'], 2500);
  const atWall = await playerState();
  check('Wall collision stops the player (north wall)', atWall.walkable && atWall.y > 4 * 16, `y=${atWall.y.toFixed(1)}`);
  await hold(['KeyS'], 400);
  const unstuck = await playerState();
  check('Player can move away from wall (not stuck)', unstuck.y - atWall.y > 10, `dy=${(unstuck.y - atWall.y).toFixed(1)}`);

  // Diagonal speed equals straight speed
  const d0 = await playerState();
  await hold(['KeyS', 'KeyD'], 400);
  const d1 = await playerState();
  const diag = Math.hypot(d1.x - d0.x, d1.y - d0.y);
  check('Diagonal movement normalised', diag < 0.4 * 92 * 1.15, `dist=${diag.toFixed(1)} in 0.4s (max ~${(0.4 * 92).toFixed(0)})`);

  // Random walk: feet must always stay on walkable ground; camera must follow
  const dirs = [['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyS', 'KeyD'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['ArrowRight'], ['ArrowDown']];
  let bad = 0;
  let outOfView = 0;
  let camMoved = false;
  const cam0 = await playerState();
  for (let i = 0; i < 40; i++) {
    await hold(dirs[(i * 7 + 3) % dirs.length], 150 + ((i * 37) % 250));
    const s = await playerState();
    if (!s.walkable) bad++;
    if (!s.inView) outOfView++;
    if (s.scrollX !== cam0.scrollX || s.scrollY !== cam0.scrollY) camMoved = true;
  }
  check('Random walk: never inside a collider', bad === 0, `${bad} bad samples / 40`);
  check('Camera follows player (always in view, scroll changes)', outOfView === 0 && camMoved);

  // Walk east through the corridor into the pillar hall to test camera bounds
  await page.evaluate(() => {
    const s = window.__ABYSS__.game.scene.getScene('DungeonScene');
    s.player.setPosition(24 * 16 + 8, 11 * 16 + 8);
  });
  await hold(['KeyD'], 1800);
  const hall = await playerState();
  check('Corridor -> pillar hall reachable', hall.x > 29 * 16 && hall.walkable, `x=${hall.x.toFixed(0)}`);
  await shot('04-pillar-hall');

  // F3 debug overlay
  await page.keyboard.press('F3');
  await page.waitForTimeout(300);
  const dbg = await page.evaluate(() => window.__ABYSS__.game.scene.getScene('DungeonScene').debug.visible);
  check('F3 toggles debug overlay + hitboxes', dbg === true);
  await shot('05-debug');
  const fps = await page.evaluate(() => Math.round(window.__ABYSS__.game.loop.actualFps));
  check('Frame loop running', fps > 0, `${fps} FPS in headless Chromium (software rendering)`);
  await page.keyboard.press('F3');

  // ESC -> menu, re-enter: scene restart must not leak listeners
  await page.keyboard.press('Escape');
  await sceneActive('MainMenuScene');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await sceneActive('DungeonScene');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await sceneActive('MainMenuScene');
  await page.waitForTimeout(300);
  const listenersAfter = await page.evaluate(() => window.__ABYSS__.EventBus.eventNames().map((n) => `${n}:${window.__ABYSS__.EventBus.listenerCount(n)}`).join(','));
  check('No EventBus listener leak after scene restarts', listenersBefore === listenersAfter, `${listenersBefore || '(none)'} vs ${listenersAfter || '(none)'}`);
  const objects = await page.evaluate(() => window.__ABYSS__.game.scene.getScene('MainMenuScene').children.length);
  check('Menu display list size stable', objects < 40, `${objects} objects`);

  check(
    'Console clean (no errors/warnings/failed requests)',
    consoleProblems.length === 0,
    consoleProblems.length ? consoleProblems.slice(0, 5).join(' | ') : `ignored ${harnessNoise} software-GL texture-upload notices`
  );
} catch (err) {
  check('Smoke test crashed', false, err.message);
  if (consoleProblems.length) console.log(consoleProblems.join('\n'));
} finally {
  await browser.close();
  if (PROD) server.httpServer.close();
  else await server.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed (${PROD ? 'production build' : 'dev server'})`);
process.exit(failed ? 1 : 0);
