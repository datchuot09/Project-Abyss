// Pure Stamina / Sanity model (design doc 5.3). Changed only through
// change(); normal combat damage never touches it.
//
// Effects are evaluated per *tier* from data; within a category the
// strongest applicable penalty wins – penalties never add up.

/**
 * @param {number} value
 * @param {object} cfg public/data/progression/stamina.json
 * @returns {{damagePenalty:number, speedPenalty:number, critical:boolean, tier:string}}
 */
export function evaluateStamina(value, cfg) {
  const matches = (rule) =>
    (rule.below !== undefined && value < rule.below) || (rule.atOrBelow !== undefined && value <= rule.atOrBelow);
  const strongest = (rules = []) => rules.filter(matches).reduce((m, r) => Math.max(m, r.penalty), 0);
  const critical = cfg.critical !== undefined && value <= cfg.critical.atOrBelow;
  const tier = (cfg.tiers ?? []).find((t) => matches(t))?.id ?? 'normal';
  return { damagePenalty: strongest(cfg.damage), speedPenalty: strongest(cfg.speed), critical, tier };
}

export class Stamina {
  constructor(cfg, max = cfg.max, current = max) {
    this.cfg = cfg;
    this.max = max;
    this.current = current;
    this.listeners = new Set();
  }

  get effects() {
    return evaluateStamina(this.current, this.cfg);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Apply a change (negative = loss). Clamped to [floor, max]. Returns the applied delta. */
  change(delta, reason = null) {
    if (!Number.isFinite(delta) || delta === 0) return 0;
    const before = this.current;
    this.current = Math.max(this.cfg.floor ?? -999, Math.min(this.max, Math.round(this.current + delta)));
    const applied = this.current - before;
    if (applied !== 0) {
      const tierBefore = evaluateStamina(before, this.cfg).tier;
      const fx = this.effects;
      for (const fn of this.listeners) fn({ current: this.current, max: this.max, delta: applied, reason, effects: fx, tierChanged: tierBefore !== fx.tier });
    }
    return applied;
  }
}
