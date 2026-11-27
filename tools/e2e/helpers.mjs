// Shared in-page helpers for the e2e suites.
/* Helpers installed on window.T inside the page */
export function installHelpers() {
  const A = window.__ABYSS__;
  window.T = {
    S: () => A.game.scene.getScene('DungeonScene'),
    events: [],
    handlers: [],
    listen() {
      const E = A.EventBus;
      for (const name of ['combat:hit', 'combat:evaded', 'entity:died', 'player:died', 'enemies:cleared']) {
        const fn = (e) => window.T.events.push({ name, team: e?.team, type: e?.type, source: e?.source, damage: e?.damage, target: e?.target?.id ?? e?.entity?.id });
        E.on(name, fn);
        window.T.handlers.push([name, fn]);
      }
    },
    unlisten() {
      for (const [name, fn] of window.T.handlers) A.EventBus.off(name, fn);
      window.T.handlers.length = 0;
    },
    count(name, filter = () => true) {
      return window.T.events.filter((e) => e.name === name && filter(e)).length;
    },
    /** keep only enemies of the given ids (first match each), destroy the rest */
    keep(...ids) {
      const s = window.T.S();
      const kept = [];
      for (const e of [...s.enemies.getChildren()]) {
        const i = ids.indexOf(e.id);
        if (i >= 0) { ids.splice(i, 1); kept.push(e); } else e.destroy();
      }
      return kept;
    },
    place(entity, x, y) {
      entity.body.reset(x, y);
      entity.body.setVelocity(0, 0);
    },
    tile: (t) => t * 16 + 8,
    screenOf(x, y) {
      const s = window.T.S();
      const cam = s.cameras.main;
      const r = document.querySelector('canvas').getBoundingClientRect();
      const z = r.width / 480;
      return { x: r.left + (x - cam.worldView.x) * z, y: r.top + (y - cam.worldView.y) * z };
    },
    inWall(entity) {
      const c = entity.body.center;
      return !window.T.S().dungeon.isWalkableWorld(c.x, c.y);
    }
  };
}

export async function restart(page) {
  await page.evaluate(() => new Promise((resolve) => {
    window.__ABYSS__.EventBus.once('floor:loaded', () => resolve());
    window.T.events.length = 0;
    window.T.S().scene.restart({ floorId: 'test_chamber', floorNumber: 1 });
  }));
  await page.waitForTimeout(300);
}

export async function aimAt(page, wx, wy) {
  const p = await page.evaluate(([x, y]) => window.T.screenOf(x, y), [wx, wy]);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(60);
}

/** If a level-up overlay is open, pick the first card until none are pending. */
export async function resolveLevelUps(page) {
  for (let i = 0; i < 10; i++) {
    const open = await page.evaluate(() => window.__ABYSS__.game.scene.isActive('LevelUpScene'));
    if (!open) return i;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
  }
  return 10;
}
