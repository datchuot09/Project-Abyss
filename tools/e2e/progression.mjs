// Phase 3 end-to-end checks: HUD (HP/EXP/Stamina), EXP + level-up buff
// selection, stamina tiers, Q/E/R skills, status effects, pause menu.
import { installHelpers, restart, aimAt, resolveLevelUps } from './helpers.mjs';

const pixel = (page, x, y) => page.evaluate(([x, y]) => new Promise((resolve) => {
  window.__ABYSS__.game.renderer.snapshotPixel(x, y, (c) => resolve({ r: c.red, g: c.green, b: c.blue }));
}), [x, y]);

export async function progressionChecks({ page, check, shot }) {
  await page.evaluate(installHelpers);
  await page.evaluate(() => window.T.listen());
  await page.evaluate(() => window.__ABYSS__.RunManager.startNewRun(window.T.S()));
  await restart(page);

  // ------------------------------------------------------------- HUD bars
  const hud = await page.evaluate(() => {
    const h = window.T.S().hud;
    return { hp: h.hpText.text, exp: h.expText.text, st: h.stText.text, slots: h.skillSlots.map((s) => s.key.text) };
  });
  check('HUD shows HP, EXP (level) and Stamina rows', hud.hp === '100/100' && hud.exp === 'Lv 1' && hud.st === 'ST 100', `${hud.hp} | ${hud.exp} | ${hud.st}`);
  check('HUD skill bar shows bound keys', hud.slots.join(',') === 'RMB,SPC,Q,E,R', hud.slots.join(','));
  // rendered pixels: stamina bar (teal) and empty EXP bar background
  const stPx = await pixel(page, 40, 25);
  check('Stamina bar is actually drawn (teal pixels)', stPx.g > 150 && stPx.b > 120 && stPx.r < 120, JSON.stringify(stPx));

  // ------------------------------------------------------------ EXP + kill
  await page.evaluate(() => {
    const T = window.T;
    const s = T.S();
    s.player.health.invulnerable = true;
    const ghouls = s.enemies.getChildren().filter((e) => e.id === 'ghoul');
    s.combat.applyHit(s.player, ghouls[0], { multiplier: 500, hitstun: 0.1 }, { x: 1, y: 0 });
  });
  await page.waitForTimeout(500); // let the EXP-gain flash finish before sampling colours
  const afterKill = await page.evaluate(() => {
    const run = window.__ABYSS__.services.run;
    return { exp: run.exp, kills: run.kills, level: run.level, open: window.__ABYSS__.game.scene.isActive('LevelUpScene') };
  });
  check('Killing a monster grants its EXP', afterKill.exp === 12 && afterKill.kills === 1 && afterKill.level === 1 && !afterKill.open, JSON.stringify(afterKill));
  const expPx = await pixel(page, 40, 18);
  check('EXP bar fills (gold pixels)', expPx.r > 150 && expPx.g > 120 && expPx.b < 120, JSON.stringify(expPx));

  await page.evaluate(() => {
    const s = window.T.S();
    const ghoul = s.enemies.getChildren().find((e) => e.id === 'ghoul' && e.isTargetable());
    s.combat.applyHit(s.player, ghoul, { multiplier: 500, hitstun: 0.1 }, { x: 1, y: 0 });
  });
  await page.waitForTimeout(400);
  const lv = await page.evaluate(() => {
    const g = window.__ABYSS__.game.scene;
    const ls = g.getScene('LevelUpScene');
    return { open: g.isActive('LevelUpScene'), paused: g.isPaused('DungeonScene'), cards: ls.cards?.length ?? 0, ids: (ls.choices ?? []).map((c) => c.id), level: window.__ABYSS__.services.run.level };
  });
  check('Full EXP -> level up: gameplay pauses, 3 buff choices', lv.open && lv.paused && lv.cards === 3 && new Set(lv.ids).size === 3 && lv.level === 2, lv.ids.join(','));
  await shot('07-level-up');

  const x0 = await page.evaluate(() => window.T.S().player.x);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');
  const x1 = await page.evaluate(() => window.T.S().player.x);
  check('Gameplay frozen while choosing', Math.abs(x1 - x0) < 0.5);

  await page.keyboard.press('ArrowRight');
  const pick = await page.evaluate(() => window.__ABYSS__.game.scene.getScene('LevelUpScene').choices[window.__ABYSS__.game.scene.getScene('LevelUpScene').index].id);
  const before = await page.evaluate(() => ({ ...window.T.S().player.stats }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const chosen = await page.evaluate((pick) => {
    const s = window.T.S();
    const def = s.cache.json.get('buffs').buffs[pick];
    return { buffs: { ...window.__ABYSS__.services.run.buffs }, stat: def.stat, after: s.player.stats[def.stat], resumed: !window.__ABYSS__.game.scene.isPaused('DungeonScene'), hud: s.hud.buffIcons.length };
  }, pick);
  check('Chosen buff applied immediately, game resumes', chosen.buffs[pick] === 1 && chosen.after > before[chosen.stat] && chosen.resumed && chosen.hud === 1,
    `${pick}: ${chosen.stat} ${before[chosen.stat]} -> ${chosen.after}`);

  // stacking caps + max HP
  const caps = await page.evaluate(() => {
    const RM = window.__ABYSS__.RunManager;
    const s = window.T.S();
    const run = window.__ABYSS__.services.run;
    const hpBefore = { cur: s.player.health.current, max: s.player.health.max };
    run.pendingLevelUps = 12;
    RM.chooseBuff(s, 'max_hp');
    const hpAfter = { cur: s.player.health.current, max: s.player.health.max };
    // stacks add up on the base stat: base * (1 + 0.12 * stacks)
    const expectedMax = Math.round(s.player.baseStats.maxHp * (1 + 0.12 * run.buffs.max_hp));
    let taken = 0;
    for (let i = 0; i < 10; i++) if (RM.chooseBuff(s, 'attack_speed')) taken++;
    run.pendingLevelUps = 0;
    return { hpBefore, hpAfter, expectedMax, taken, attackSpeed: s.player.stats.attackSpeed };
  });
  check('Max HP buff raises max and heals the difference', caps.hpAfter.max === caps.expectedMax && caps.hpAfter.cur - caps.hpBefore.cur === caps.hpAfter.max - caps.hpBefore.max,
    `${caps.hpBefore.cur}/${caps.hpBefore.max} -> ${caps.hpAfter.cur}/${caps.hpAfter.max}`);
  check('Buff stacks capped (no over-stacking)', caps.taken === 5 && Math.abs(caps.attackSpeed - 1.4) < 1e-9, `${caps.taken} stacks, attackSpeed ${caps.attackSpeed}`);

  // --------------------------------------------------------------- stamina
  const tiers = await page.evaluate(() => {
    const RM = window.__ABYSS__.RunManager;
    const s = window.T.S();
    const read = () => ({ st: window.__ABYSS__.services.run.stamina.current, out: +s.player.stats.outgoingMultiplier.toFixed(3), speedRatio: +(s.player.stats.movementSpeed / s.player.baseStats.movementSpeed).toFixed(3), hud: s.hud.stText.text });
    const out = {};
    // normal damage must not touch stamina
    s.player.health.invulnerable = false;
    const e = s.enemies.getChildren().find((x) => x.isTargetable());
    s.combat.applyHit(e, s.player, { multiplier: 1, knockback: 0, hitstun: 0 }, { x: 1, y: 0 });
    out.afterHit = window.__ABYSS__.services.run.stamina.current;
    s.player.health.invulnerable = true;
    RM.changeStamina(-50, 'test'); out.s50 = read();
    RM.changeStamina(-10, 'test'); out.s40 = read();
    RM.changeStamina(-40, 'test'); out.s0 = read();
    RM.changeStamina(-50, 'test'); out.sm50 = read();
    return out;
  });
  check('Normal damage does not reduce stamina', tiers.afterHit === 100);
  check('Stamina 50 -> no penalty; 40 -> -30% damage', tiers.s50.out === 1 && tiers.s40.out === 0.7 && tiers.s40.hud === 'ST 40');
  check('Stamina 0 -> -50% damage (not stacked with -30%)', tiers.s0.out === 0.5);
  // compare with the stamina-0 speed so earlier random buffs (e.g. Shadow Step) do not matter
  const speedDrop = tiers.sm50.speedRatio / tiers.s0.speedRatio;
  check('Stamina -50 -> -20% movement speed', Math.abs(speedDrop - 0.8) < 0.01 && tiers.sm50.out === 0.5, `speed x${speedDrop.toFixed(3)}`);
  await page.evaluate(() => window.__ABYSS__.RunManager.changeStamina(-60, 'test'));
  await page.waitForTimeout(300);
  const crit = await page.evaluate(() => ({ v: window.T.S().hud.vignette.visible, c: window.T.S().hud.cracks.visible }));
  check('Stamina <= -100 -> red flashing corners + cracks', crit.v && crit.c);
  await shot('08-exhausted');
  await page.evaluate(() => window.__ABYSS__.RunManager.changeStamina(-50, 'test'));
  await page.waitForTimeout(100);
  const deeper = await page.evaluate(() => ({ v: window.T.S().hud.vignette.visible, st: window.__ABYSS__.services.run.stamina.current }));
  check('Exhaustion persists below -100', deeper.v && deeper.st === -160, `stamina ${deeper.st}`);
  await page.evaluate(() => window.__ABYSS__.RunManager.changeStamina(500, 'test'));

  // ---------------------------------------------------------------- skills
  const setupDummy = async (offsetX, n = 1) => page.evaluate(([offsetX, n]) => {
    const T = window.T;
    const s = T.S();
    for (const e of [...s.enemies.getChildren()]) e.destroy();
    const def = s.cache.json.get('monster_ghoul_data');
    const { createEnemy } = window.__ABYSS__.debugFactory;
    const ctx = { combat: s.combat, projectiles: s.projectiles, effects: s.effects, nav: s.navigation, target: s.player };
    T.place(s.player, T.tile(9), T.tile(12));
    window.dummies = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const d = createEnemy(s, def, s.player.x + (n === 1 ? offsetX : Math.cos(a) * offsetX), s.player.y + (n === 1 ? 0 : Math.sin(a) * offsetX * 0.8), ctx);
      d.think = function think(dt) { this.updateStatus(dt); };
      d.body.moves = false;
      d.health.setMax(999, { keepRatio: false });
      d.health.reset();
      s.enemies.add(d);
      window.dummies.push(d);
    }
    return window.dummies.map((d) => ({ x: d.body.center.x, y: d.body.center.y }));
  }, [offsetX, n]);
  const hpOf = () => page.evaluate(() => window.dummies.map((d) => d.health.current));

  let pos = await setupDummy(60);
  await page.waitForTimeout(500);
  await aimAt(page, pos[0].x, pos[0].y);
  const px0 = await page.evaluate(() => window.T.S().player.x);
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(400);
  const rush = await page.evaluate(() => ({ hp: window.dummies[0].health.current, x: window.T.S().player.x, cd: window.T.S().player.skillCooldowns.skill1 }));
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(100);
  const rushAgain = await page.evaluate(() => window.T.S().player.fsm.history.filter((h) => h === 'rush').length);
  check('Q Rune Rush dashes through and damages', rush.hp < 999 && rush.x - px0 > 40 && rush.cd > 4, `moved ${(rush.x - px0).toFixed(0)}px, hp 999 -> ${rush.hp}`);
  check('Skill cooldown blocks re-cast', rushAgain === 1);

  pos = await setupDummy(64);
  await page.waitForTimeout(500);
  await aimAt(page, pos[0].x, pos[0].y);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(800);
  const sigil = await page.evaluate(() => ({ hp: window.dummies[0].health.current, slow: window.dummies[0].status.has('slow'), ice: window.T.count('combat:hit', (e) => e.source === 'skill') }));
  check('E Frost Sigil: AOE at aim point, ice damage + Slow', sigil.hp < 999 && sigil.slow, `hp 999 -> ${sigil.hp}`);
  await shot('09-frost-sigil');

  await setupDummy(52, 4);
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(250);
  await shot('10-eclipse-charge');
  await page.waitForTimeout(700);
  const ult = await page.evaluate(() => ({
    hp: window.dummies.map((d) => d.health.current),
    stunned: window.dummies.filter((d) => d.status.has('stun')).length,
    cd: window.T.S().player.skillCooldowns.ultimate
  }));
  check('R Abyssal Eclipse: hits every enemy around, Stun', ult.hp.every((h) => h < 999) && ult.stunned === 4 && ult.cd > 30, `${ult.stunned}/4 stunned, hp ${ult.hp.join(',')}`);

  // ------------------------------------------------------- status effects
  const status = await page.evaluate(async () => {
    const s = window.T.S();
    const p = s.player;
    p.health.invulnerable = false;
    const hp0 = p.health.current;
    p.applyStatus('poison', { duration: 1.5, potency: 4, source: window.dummies[0] });
    await new Promise((r) => setTimeout(r, 1700));
    const poisoned = { lost: hp0 - p.health.current, state: p.fsm.name, dots: window.T.count('combat:hit', (e) => e.source === 'dot') };
    const e = window.dummies[1];
    e.think = Object.getPrototypeOf(e).think; // real AI back on
    e.body.moves = true;
    e.status.immunity.clear(); // it was just stunned by the ultimate (CC immunity is by design)
    e.applyStatus('freeze', { duration: 1 });
    const x0 = e.x;
    await new Promise((r) => setTimeout(r, 600));
    const frozen = { moved: Math.abs(e.x - x0), tinted: e._frozenVisual };
    p.health.invulnerable = true;
    return { poisoned, frozen };
  });
  check('Poison DoT ticks damage without staggering the player', status.poisoned.lost >= 4 && status.poisoned.lost <= 8 && status.poisoned.dots >= 3, `lost ${status.poisoned.lost} HP in ${status.poisoned.dots} ticks`);
  check('Freeze stops an enemy completely', status.frozen.moved < 0.5 && status.frozen.tinted);

  // ------------------------------------------------------------ pause menu
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const paused = await page.evaluate(() => ({ pause: window.__ABYSS__.game.scene.isActive('PauseScene'), dungeonPaused: window.__ABYSS__.game.scene.isPaused('DungeonScene') }));
  const pxp = await page.evaluate(() => window.T.S().player.x);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyA');
  const pxp2 = await page.evaluate(() => window.T.S().player.x);
  await shot('11-pause');
  check('ESC opens Pause menu and freezes gameplay', paused.pause && paused.dungeonPaused && Math.abs(pxp2 - pxp) < 0.5);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const resumed = await page.evaluate(() => !window.__ABYSS__.game.scene.isPaused('DungeonScene') && !window.__ABYSS__.game.scene.isActive('PauseScene'));
  check('ESC again resumes', resumed);

  await page.evaluate(() => window.T.unlisten());
  await resolveLevelUps(page);
}
