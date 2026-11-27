// Pure damage maths (unit tested). Every damage source in the game goes
// through calculateDamage so balance lives in one place.
import { clamp } from '../core/math.js';

export const COMBAT_TUNING = Object.freeze({
  DEFENSE_K: 40, // defense / (defense + K) = % reduction
  MAX_DEFENSE_REDUCTION: 0.75,
  MAX_DAMAGE_REDUCTION: 0.8,
  VARIANCE: 0.1, // +-10% roll
  DEFAULT_CRIT_MULTIPLIER: 1.5
});

/**
 * @param {object} p
 * @param {object} p.attacker  stats: physicalDamage, magicDamage, critRate, critMultiplier, outgoingMultiplier
 * @param {object} p.defender  stats: defense, damageReduction, damageTakenMultiplier
 * @param {number} [p.multiplier=1]   skill/attack coefficient
 * @param {'physical'|'magic'} [p.type='physical']
 * @param {string|null} [p.element]   Fire/Ice/... (Phase 6 uses it)
 * @param {number} [p.flat=0]         flat bonus added before multipliers
 * @param {boolean} [p.canCrit=true]
 * @param {() => number} [p.rng=Math.random]
 */
export function calculateDamage({ attacker, defender, multiplier = 1, type = 'physical', element = null, flat = 0, canCrit = true, rng = Math.random }) {
  const T = COMBAT_TUNING;
  const base = type === 'magic' ? attacker.magicDamage ?? 0 : attacker.physicalDamage ?? 0;
  let raw = Math.max(0, base * multiplier + flat);
  raw *= attacker.outgoingMultiplier ?? 1;
  raw *= 1 + (rng() * 2 - 1) * T.VARIANCE;

  const crit = canCrit && rng() < clamp(attacker.critRate ?? 0, 0, 1);
  if (crit) raw *= attacker.critMultiplier ?? T.DEFAULT_CRIT_MULTIPLIER;

  const def = Math.max(0, defender.defense ?? 0);
  const defenseReduction = Math.min(T.MAX_DEFENSE_REDUCTION, def / (def + T.DEFENSE_K));
  const damageReduction = clamp(defender.damageReduction ?? 0, 0, T.MAX_DAMAGE_REDUCTION);
  raw *= (1 - defenseReduction) * (1 - damageReduction) * (defender.damageTakenMultiplier ?? 1);

  return { amount: Math.max(1, Math.round(raw)), crit, type, element, defenseReduction };
}
