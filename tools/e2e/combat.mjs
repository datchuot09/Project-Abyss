// Phase 2 end-to-end combat checks. Runs inside smoke-test.mjs with the same
// page. Each scenario restarts DungeonScene for a clean, deterministic state.

/* Helpers installed on window.T inside the page */
function installHelpers() {
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

async function restart(page) {
  await page.evaluate(() => new Promise((resolve) => {
    window.__ABYSS__.EventBus.once('floor:loaded', () => resolve());
    window.T.events.length = 0;
    window.T.S().scene.restart({ floorId: 'test_chamber', floorNumber: 1 });
  }));
  await page.waitForTimeout(300);
}

async function aimAt(page, wx, wy) {
  const p = await page.evaluate(([x, y]) => window.T.screenOf(x, y), [wx, wy]);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(60);
}

export async function combatChecks({ page, check }) {
  await page.evaluate(installHelpers);
  await page.evaluate(() => window.T.listen());

  // ---------------------------------------------------------------- spawns
  await restart(page);
  const spawns = await page.evaluate(() => {
    const s = window.T.S();
    const list = s.enemies.getChildren();
    const by = {};
    list.forEach((e) => (by[e.id] = (by[e.id] ?? 0) + 1));
    return { n: list.length, by, inWall: list.filter((e) => window.T.inWall(e)).length };
  });
  check('Enemies spawned from Tiled objects (3 types)', spawns.n === 9 && spawns.by.ghoul === 3 && spawns.by.bone_archer === 2 && spawns.by.abyss_mite === 4,
    JSON.stringify(spawns.by));
  check('No enemy spawned inside a collider', spawns.inWall === 0);

  // ---------------------------------------------------------- melee + combo
  await page.evaluate(() => {
    const T = window.T;
    const s = T.S();
    const [g] = T.keep('ghoul');
    g.think = () => {}; // frozen training dummy: no AI, no knockback drift
    g.body.moves = false;
    g.health.setMax(999, { keepRatio: false }); g.health.reset();
    s.player.health.invulnerable = true;
    T.place(s.player, T.tile(10), T.tile(12));
    T.place(g, T.tile(10) + 22, T.tile(12));
    window.dummy = g;
  });
  await page.waitForTimeout(700);
  let g = await page.evaluate(() => ({ x: window.dummy.body.center.x, y: window.dummy.body.center.y, hp: window.dummy.health.current }));
  await aimAt(page, g.x, g.y);
  await page.mouse.click(...Object.values(await page.evaluate(([x, y]) => window.T.screenOf(x, y), [g.x, g.y])));
  await page.waitForTimeout(450);
  let after = await page.evaluate(() => ({ hp: window.dummy.health.current, hits: window.T.count('combat:hit', (e) => e.target === 'ghoul'), nums: window.T.S().effects.numbers.filter((n) => n.active).length }));
  check('Left click melee hits enemy in aim direction', after.hp < g.hp && after.hits === 1, `hp ${g.hp} -> ${after.hp}`);
  check('Damage number shown on hit', after.nums >= 1);

  // 3-hit combo via buffered clicks
  await page.evaluate(() => (window.T.events.length = 0));
  const pt = await page.evaluate(([x, y]) => window.T.screenOf(x, y), [g.x, g.y]);
  for (let i = 0; i < 3; i++) {
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(260);
  }
  await page.waitForTimeout(500);
  const combo = await page.evaluate(() => ({
    hits: window.T.count('combat:hit', (e) => e.target === 'ghoul'),
    attacks: window.T.S().player.fsm.history.filter((h) => h === 'attack').length,
    history: window.T.S().player.fsm.history.join(','),
    dist: window.T.S().player.distanceTo(window.dummy).toFixed(1)
  }));
  check('3-hit combo: each swing lands exactly once', combo.hits === 3, `${combo.hits} hits; ${combo.history}; dist ${combo.dist}`);

  // Swing away from the enemy must not hit (arc is real geometry, not a VFX)
  await page.evaluate(() => (window.T.events.length = 0));
  await aimAt(page, g.x - 80, g.y);
  const away = await page.evaluate(([x, y]) => window.T.screenOf(x, y), [g.x - 80, g.y]);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(450);
  check('Swing facing away does not hit (arc check)', (await page.evaluate(() => window.T.count('combat:hit'))) === 0);

  // ------------------------------------------------------------ projectile
  await page.evaluate(() => {
    const T = window.T;
    T.events.length = 0;
    T.place(T.S().player, window.dummy.body.center.x - 90, window.dummy.body.center.y);
  });
  await page.waitForTimeout(700);
  g = await page.evaluate(() => ({ x: window.dummy.body.center.x, y: window.dummy.body.center.y, hp: window.dummy.health.current }));
  await aimAt(page, g.x, g.y);
  const gp = await page.evaluate(([x, y]) => window.T.screenOf(x, y), [g.x, g.y]);
  await page.mouse.click(gp.x, gp.y, { button: 'right' });
  await page.waitForTimeout(150);
  const flying = await page.evaluate(() => window.T.S().projectiles.activeCount);
  await page.waitForTimeout(700);
  const bolt = await page.evaluate(() => ({ hp: window.dummy.health.current, magic: window.T.count('combat:hit', (e) => e.type === 'magic' && e.source === 'projectile'), left: window.T.S().projectiles.activeCount }));
  check('Right click fires arcane bolt projectile', flying === 1, `${flying} in flight`);
  check('Bolt collides with enemy and deals magic damage', bolt.magic === 1 && bolt.hp < g.hp && bolt.left === 0, `hp ${g.hp} -> ${bolt.hp}`);

  // Projectile vs wall + pool bound
  const wall = await page.evaluate(async () => {
    const s = window.T.S();
    const p = s.player;
    const before = window.T.count('combat:hit');
    s.projectiles.fire(p, 'arcane_bolt', p.body.center.x, p.body.center.y, 0, -1, { multiplier: 1, type: 'magic' });
    await new Promise((r) => setTimeout(r, 1200));
    const afterWall = { active: s.projectiles.activeCount, hits: window.T.count('combat:hit') - before };
    for (let i = 0; i < 300; i++) s.projectiles.fire(p, 'arcane_bolt', p.body.center.x, p.body.center.y, 0, -1, { multiplier: 1 });
    afterWall.poolSize = s.projectiles.group.getLength();
    return afterWall;
  });
  check('Projectile stops at walls', wall.active === 0 && wall.hits === 0);
  check('Projectile pool is bounded (no unbounded allocation)', wall.poolSize <= 96, `${wall.poolSize} pooled objects after 300 shots`);
  await page.waitForTimeout(1500);

  // ------------------------------------------------------------------ dodge
  const dodge = await page.evaluate(async () => {
    const s = window.T.S();
    const p = s.player;
    p.health.invulnerable = false;
    window.T.events.length = 0;
    return p.health.current;
  });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(80);
  await page.keyboard.press('Space');
  await page.waitForTimeout(60);
  const during = await page.evaluate(() => {
    const s = window.T.S();
    const p = s.player;
    const res = s.combat.applyHit(window.dummy, p, { multiplier: 5, knockback: 100, hitstun: 0.2 }, { x: 1, y: 0 });
    return { state: p.fsm.name, iframes: p.iframeTime, hit: res, hp: p.health.current, evaded: window.T.count('combat:evaded') };
  });
  await page.keyboard.up('KeyD');
  check('Space = dodge roll with i-frames', during.state === 'dodge' && during.iframes > 0);
  check('Hits during i-frames are evaded (no damage)', during.hit === null && during.hp === dodge && during.evaded === 1);
  await page.waitForTimeout(400);
  const outside = await page.evaluate(() => {
    const s = window.T.S();
    const p = s.player;
    const hp = p.health.current;
    s.combat.applyHit(window.dummy, p, { multiplier: 1, knockback: 100, hitstun: 0.2 }, { x: 1, y: 0 });
    return { before: hp, after: p.health.current, state: p.fsm.name };
  });
  check('Hit outside i-frames damages + staggers player', outside.after < outside.before && outside.state === 'hit', `${outside.before} -> ${outside.after}`);

  // --------------------------------------------------------- AI: Ghoul
  const runAI = async (id, tx, ty, ptx, pty, ms) => {
    await restart(page);
    await page.evaluate(([id, tx, ty, ptx, pty]) => {
      const T = window.T;
      const s = T.S();
      const [e] = T.keep(id);
      s.player.health.setMax(5000, { keepRatio: false });
      s.player.health.reset();
      T.place(e, T.tile(tx), T.tile(ty));
      T.place(s.player, T.tile(ptx), T.tile(pty));
      window.subject = e;
      window.samples = { inWall: 0, n: 0, minDist: Infinity, maxDist: 0 };
      window.sampler = setInterval(() => {
        if (!e.active) return;
        window.samples.n++;
        if (T.inWall(e)) window.samples.inWall++;
        const d = e.distanceTo(s.player);
        window.samples.minDist = Math.min(window.samples.minDist, d);
        window.samples.maxDist = Math.max(window.samples.maxDist, d);
      }, 100);
    }, [id, tx, ty, ptx, pty]);
    await page.waitForTimeout(ms);
    return page.evaluate(() => {
      clearInterval(window.sampler);
      const s = window.T.S();
      return {
        history: [...new Set(window.subject.fsm.history)],
        playerHp: s.player.health.current,
        hits: window.T.count('combat:hit', (e) => e.team === 'player'),
        enemyShots: s.projectiles.spawnedTotal,
        stuck: window.subject.stuckEvents ?? 0,
        ...window.samples
      };
    });
  };

  const ghoul = await runAI('ghoul', 18, 6, 12, 8, 4500);
  check('Ghoul AI: detect -> chase -> telegraph -> lunge', ['alert', 'chase', 'windup', 'lunge', 'recover'].every((s) => ghoul.history.includes(s)), ghoul.history.join(' > '));
  check('Ghoul lands real hits on the player', ghoul.hits > 0 && ghoul.playerHp < 5000, `${ghoul.hits} hits`);
  check('Ghoul never inside walls', ghoul.inWall === 0, `${ghoul.n} samples`);

  const archer = await runAI('bone_archer', 42, 14, 39, 14, 5000);
  check('Archer AI: retreats when the player is close', archer.history.includes('retreat') && archer.maxDist > 60, `max distance ${archer.maxDist.toFixed(0)}px`);
  check('Archer AI: aims (telegraph) and shoots arrows', archer.history.includes('aim') && archer.history.includes('loose') && archer.enemyShots > 0, `${archer.enemyShots} arrows`);
  check('Arrows hit the player', archer.hits > 0, `${archer.hits} hits`);

  const mite = await runAI('abyss_mite', 17, 17, 13, 15, 4500);
  check('Mite AI: orbit -> shiver telegraph -> dash', ['chase', 'windup', 'dash'].every((s) => mite.history.includes(s)) && mite.hits > 0, mite.history.join(' > '));

  // Pathfinding: ghoul in the pillar hall, player in the antechamber behind the wall (no line of sight)
  await restart(page);
  const path = await page.evaluate(async () => {
    const T = window.T;
    const s = T.S();
    const [e] = T.keep('ghoul');
    s.player.health.invulnerable = true;
    T.place(e, T.tile(29), T.tile(7));
    T.place(s.player, T.tile(17), T.tile(15));
    await new Promise((r) => setTimeout(r, 300));
    const c = e.body.center;
    const p = s.player.body.center;
    const losBefore = s.navigation.hasLineOfSight(c.x, c.y, p.x, p.y);
    e.aggro();
    let inWall = 0;
    let min = Infinity;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (T.inWall(e)) inWall++;
      min = Math.min(min, e.distanceTo(s.player));
      if (min < 30) break;
    }
    return { losBefore, inWall, min, stuck: e.stuckEvents ?? 0, state: e.fsm.name };
  });
  check('Pathfinding: enemy navigates around walls to an out-of-sight player', !path.losBefore && path.min < 30 && path.inWall === 0,
    `closest ${path.min.toFixed(0)}px, stuck recoveries ${path.stuck}`);

  // ------------------------------------------------------- kill all / death
  await restart(page);
  const clear = await page.evaluate(async () => {
    const s = window.T.S();
    s.player.health.invulnerable = true;
    for (const e of [...s.enemies.getChildren()]) s.combat.applyHit(s.player, e, { multiplier: 500, knockback: 100, hitstun: 0.2 }, { x: 1, y: 0 });
    const died = window.T.count('entity:died');
    const cleared = window.T.count('enemies:cleared');
    await new Promise((r) => setTimeout(r, 3500));
    return { died, cleared, remaining: s.enemies.getLength(), combatants: s.combat.combatants.size };
  });
  check('Killing every enemy fires ENEMIES_CLEARED once', clear.died === 9 && clear.cleared === 1);
  check('Dead enemies are cleaned up (objects destroyed)', clear.remaining === 0 && clear.combatants === 1, `${clear.remaining} left, ${clear.combatants} combatants`);

  await restart(page);
  await page.evaluate(() => {
    const s = window.T.S();
    const [e] = window.T.keep('ghoul');
    e.think = () => {};
    s.player.health.current = 1;
    s.combat.applyHit(e, s.player, { multiplier: 1, knockback: 50, hitstun: 0.2 }, { x: 1, y: 0 });
  });
  await page.waitForTimeout(2200);
  const dead = await page.evaluate(() => ({ state: window.T.S().player.fsm.name, died: window.T.count('player:died'), defeated: window.T.S().defeated }));
  check('Player death: death animation then defeat screen', dead.state === 'dead' && dead.died === 1 && dead.defeated);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  const revived = await page.evaluate(() => ({ hp: window.T.S().player.health.current, enemies: window.T.S().enemies.getLength(), defeated: window.T.S().defeated }));
  check('Enter on defeat screen restarts the floor', revived.hp === 100 && revived.enemies === 9 && !revived.defeated);

  // ------------------------------------------------------------ stress
  const perf = await page.evaluate(async () => {
    const s = window.T.S();
    s.player.health.invulnerable = true;
    const def = s.cache.json.get('monster_abyss_mite_data');
    const { createEnemy } = window.__ABYSS__.debugFactory;
    const ctx = { combat: s.combat, projectiles: s.projectiles, effects: s.effects, nav: s.navigation, target: s.player };
    const pc = s.player.body.center;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const x = pc.x + Math.cos(a) * 60;
      const y = pc.y + Math.sin(a) * 50;
      if (!s.dungeon.isWalkableWorld(x, y)) continue;
      const e = createEnemy(s, def, x, y, ctx);
      s.enemies.add(e);
      e.aggro();
    }
    const n = s.enemies.getLength();
    let inWall = 0;
    const fps = [];
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      fps.push(s.game.loop.actualFps);
      for (const e of s.enemies.getChildren()) if (e.isTargetable() && window.T.inWall(e)) inWall++;
    }
    return { n, inWall, fps: Math.round(fps.reduce((a, b) => a + b) / fps.length), minFps: Math.round(Math.min(...fps)) };
  });
  check('Stress: 40+ enemies swarming, none inside walls', perf.inWall === 0, `${perf.n} enemies`);
  check('Stress FPS (headless software GL)', perf.fps > 0, `avg ${perf.fps} / min ${perf.minFps} FPS with ${perf.n} enemies`);

  await page.evaluate(() => window.T.unlisten());
  await restart(page);
}
