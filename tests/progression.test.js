import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StatusEffects } from '../src/systems/StatusEffects.js';
import { Stamina, evaluateStamina } from '../src/systems/Stamina.js';
import { computeStats } from '../src/systems/StatCalculator.js';
import { RunState } from '../src/systems/RunState.js';

const json = (p) => JSON.parse(readFileSync(new URL(`../public/data/${p}`, import.meta.url)));
const statusDefs = json('skills/status_effects.json');
const staminaCfg = json('progression/stamina.json');
const { buffs: buffDefs, caps } = json('progression/buffs.json');
const levels = json('progression/levels.json');

test('status: re-apply refreshes to longer duration and keeps stronger potency (no stacking)', () => {
  const s = new StatusEffects(statusDefs);
  s.apply('slow', { duration: 2, potency: 0.3 });
  s.apply('slow', { duration: 1, potency: 0.5 });
  assert.equal(s.list()[0].remaining, 2);
  assert.equal(s.speedMultiplier, 0.5);
  s.apply('slow', { duration: 4, potency: 0.2 });
  assert.equal(s.list()[0].remaining, 4);
  assert.equal(s.speedMultiplier, 0.5);
});

test('status: DoT ticks exact damage and expires', () => {
  const s = new StatusEffects(statusDefs);
  s.apply('poison', { duration: 2, potency: 4 });
  let total = 0;
  for (let i = 0; i < 30; i++) total += s.update(0.1).ticks.reduce((a, t) => a + t.amount, 0);
  assert.equal(Math.round(total), 8); // 4 dps * 2 s
  assert.equal(s.has('poison'), false);
});

test('status: freeze disables, then grants immunity to the disable group', () => {
  const s = new StatusEffects(statusDefs);
  assert.ok(s.apply('freeze', { duration: 1 }));
  assert.equal(s.canAct, false);
  assert.equal(s.speedMultiplier, 0);
  s.update(1.01);
  assert.equal(s.canAct, true);
  assert.equal(s.apply('stun', { duration: 1 }), false); // shared group immunity
  s.update(2.1);
  assert.ok(s.apply('stun', { duration: 1 }));
});

test('status: durations capped by maxDuration, unknown ids rejected', () => {
  const s = new StatusEffects(statusDefs);
  s.apply('freeze', { duration: 99 });
  assert.equal(s.list()[0].remaining, statusDefs.freeze.maxDuration);
  assert.equal(s.apply('nope', { duration: 1 }), false);
});

test('stamina thresholds match design doc 5.3 and never add up', () => {
  const at = (v) => evaluateStamina(v, staminaCfg);
  assert.deepEqual([at(100).damagePenalty, at(51).damagePenalty, at(50).damagePenalty], [0, 0, 0]);
  assert.equal(at(49).damagePenalty, 0.3);
  assert.equal(at(0).damagePenalty, 0.5); // not 0.8
  assert.equal(at(-49).speedPenalty, 0);
  assert.equal(at(-50).speedPenalty, 0.2);
  assert.equal(at(-50).damagePenalty, 0.5);
  assert.equal(at(-99).critical, false);
  assert.equal(at(-100).critical, true);
  assert.equal(at(-250).critical, true); // stays critical below -100
  assert.equal(at(-250).speedPenalty, 0.2);
});

test('stamina change is clamped and reports tier changes', () => {
  const st = new Stamina(staminaCfg);
  const events = [];
  st.onChange((e) => events.push(e));
  assert.equal(st.change(+50), 0); // already at max
  st.change(-60, 'test');
  assert.equal(st.current, 40);
  assert.equal(events[0].tierChanged, true);
  st.change(-9999);
  assert.equal(st.current, staminaCfg.floor);
});

test('stats: buffs add per stat, stacks clamped, caps applied', () => {
  const base = { physicalDamage: 10, attackSpeed: 1, critRate: 0.05, movementSpeed: 92, maxHp: 100 };
  const s = computeStats(base, { buffs: { physical_damage: 2, attack_speed: 99, crit_rate: 20, move_speed: 4, max_hp: 1 }, buffDefs, caps });
  assert.ok(Math.abs(s.physicalDamage - 12.4) < 1e-9);
  assert.equal(s.attackSpeed, 1.4); // 5 stacks max (1 + 5*0.08)
  assert.ok(Math.abs(s.critRate - 0.35) < 1e-9); // 0.05 + 6*0.05
  assert.ok(Math.abs(s.movementSpeed - 92 * 1.24) < 1e-9);
  assert.equal(s.maxHp, 112);
});

test('stats: stamina penalties applied once, on top of buffs', () => {
  const base = { physicalDamage: 10, movementSpeed: 100, outgoingMultiplier: 1 };
  const s = computeStats(base, { buffs: { move_speed: 1 }, buffDefs, caps, stamina: evaluateStamina(-60, staminaCfg) });
  assert.equal(s.outgoingMultiplier, 0.5);
  assert.ok(Math.abs(s.movementSpeed - 106 * 0.8) < 1e-9);
});

test('run: EXP curve, multi level-up, buff caps and choices', () => {
  const run = new RunState({ characterId: 'wanderer', levelCurve: levels, staminaConfig: staminaCfg });
  assert.equal(run.expToNext(1), 20);
  const gained = run.addExp(20 + run.expToNext(2) + 3);
  assert.equal(gained, 2);
  assert.equal(run.level, 3);
  assert.equal(run.exp, 3);
  assert.equal(run.pendingLevelUps, 2);
  const def = buffDefs.move_speed;
  for (let i = 0; i < 10; i++) run.addBuff(def);
  assert.equal(run.stacks('move_speed'), def.maxStacks);
  const choices = run.rollBuffChoices(buffDefs, 3, () => 0.42);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((c) => c.id)).size, 3);
  assert.ok(!choices.some((c) => c.id === 'move_speed'));
});
