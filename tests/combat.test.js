import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage, COMBAT_TUNING } from '../src/systems/DamageCalculator.js';
import { Health } from '../src/systems/Health.js';
import { StateMachine } from '../src/systems/StateMachine.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const atk = { physicalDamage: 10, magicDamage: 20, critRate: 0, critMultiplier: 2 };

test('no variance roll (0.5) and no defense -> exact base damage', () => {
  const r = calculateDamage({ attacker: atk, defender: {}, rng: seq(0.5, 0.99) });
  assert.equal(r.amount, 10);
  assert.equal(r.crit, false);
});

test('magic attacks use magicDamage', () => {
  assert.equal(calculateDamage({ attacker: atk, defender: {}, type: 'magic', rng: seq(0.5, 0.99) }).amount, 20);
});

test('crit multiplies damage', () => {
  const r = calculateDamage({ attacker: { ...atk, critRate: 1 }, defender: {}, rng: seq(0.5, 0) });
  assert.equal(r.crit, true);
  assert.equal(r.amount, 20);
});

test('defense formula def/(def+K) and cap', () => {
  const r = calculateDamage({ attacker: { physicalDamage: 100 }, defender: { defense: 40 }, rng: seq(0.5, 0.99) });
  assert.equal(r.amount, 50);
  const capped = calculateDamage({ attacker: { physicalDamage: 100 }, defender: { defense: 1e9 }, rng: seq(0.5, 0.99) });
  assert.equal(capped.amount, Math.round(100 * (1 - COMBAT_TUNING.MAX_DEFENSE_REDUCTION)));
});

test('damage reduction is capped and damage never drops below 1', () => {
  const r = calculateDamage({ attacker: { physicalDamage: 100 }, defender: { damageReduction: 5 }, rng: seq(0.5, 0.99) });
  assert.equal(r.amount, 20);
  assert.equal(calculateDamage({ attacker: { physicalDamage: 0.1 }, defender: { defense: 100 }, rng: seq(0.5, 0.99) }).amount, 1);
});

test('variance stays within +-10%', () => {
  for (const v of [0, 0.25, 0.75, 0.9999]) {
    const a = calculateDamage({ attacker: { physicalDamage: 100 }, defender: {}, rng: seq(v, 0.99) }).amount;
    assert.ok(a >= 90 && a <= 110, `${a}`);
  }
});

test('Health: damage clamps, death, no heal when dead, invulnerability', () => {
  const h = new Health(50);
  const events = [];
  h.onChange((e) => events.push(e.kind));
  assert.equal(h.damage(20), 20);
  h.invulnerable = true;
  assert.equal(h.damage(20), 0);
  h.invulnerable = false;
  assert.equal(h.heal(100), 20);
  assert.equal(h.damage(999), 50);
  assert.ok(h.isDead);
  assert.equal(h.damage(5), 0);
  assert.equal(h.heal(10), 0);
  assert.deepEqual(events, ['damage', 'heal', 'death']);
});

test('Health.setMax keeps ratio', () => {
  const h = new Health(100, 50);
  h.setMax(200);
  assert.equal(h.current, 100);
});

test('StateMachine enter/exit order and elapsed reset', () => {
  const log = [];
  const owner = {};
  const fsm = new StateMachine(owner, {
    a: { enter() { log.push('enter a'); }, exit() { log.push('exit a'); }, update(dt) { log.push(`upd ${dt}`); } },
    b: { enter(d) { log.push(`enter b ${d}`); } }
  }, 'a');
  fsm.update(0.5);
  assert.equal(fsm.elapsed, 0.5);
  fsm.set('b', 7);
  assert.equal(fsm.elapsed, 0);
  assert.deepEqual(log, ['enter a', 'upd 0.5', 'exit a', 'enter b 7']);
  assert.throws(() => fsm.set('zzz'));
});
