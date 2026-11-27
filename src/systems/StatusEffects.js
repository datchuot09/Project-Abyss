// Pure status-effect container (unit tested). One instance per combatant.
//
// Kinds (public/data/skills/status_effects.json):
//   dot     – damage over time (burn, poison): potency = damage per second
//   slow    – movement speed reduction: potency = 0..1
//   root    – cannot move, can still act
//   disable – cannot move or act (freeze, stun)
//
// Stacking rules (design doc rule 11: no wrong stacking): re-applying an
// effect refreshes duration to the longer one and keeps the stronger potency;
// effects never add up. Effects sharing an immunity `group` grant a short
// immunity when they end, so crowd control cannot chain forever.
export class StatusEffects {
  constructor(defs) {
    this.defs = defs ?? {};
    this.active = new Map();
    this.immunity = new Map(); // group -> seconds
  }

  has(id) {
    return this.active.has(id);
  }

  isImmune(id) {
    const g = this.defs[id]?.group;
    return Boolean(g && (this.immunity.get(g) ?? 0) > 0);
  }

  apply(id, { duration, potency = 0, source = null } = {}) {
    const def = this.defs[id];
    if (!def || !(duration > 0) || this.isImmune(id)) return false;
    const d = Math.min(duration, def.maxDuration ?? duration);
    const cur = this.active.get(id);
    if (cur) {
      cur.remaining = Math.max(cur.remaining, d);
      cur.potency = Math.max(cur.potency, potency);
      if (source) cur.source = source;
      return true;
    }
    this.active.set(id, { id, def, remaining: d, potency, source, tick: def.tickInterval ?? 0 });
    return true;
  }

  remove(id) {
    this.active.delete(id);
  }

  clear() {
    this.active.clear();
    this.immunity.clear();
  }

  /** Advance time. Returns DoT ticks to apply and the ids that expired. */
  update(dt) {
    const ticks = [];
    const expired = [];
    for (const [g, t] of this.immunity) {
      if (t - dt <= 0) this.immunity.delete(g);
      else this.immunity.set(g, t - dt);
    }
    for (const [id, e] of this.active) {
      const step = Math.min(dt, e.remaining);
      if (e.def.kind === 'dot') {
        e.tick -= step;
        while (e.tick <= 1e-9) {
          ticks.push({ id, amount: e.potency * e.def.tickInterval, source: e.source, element: e.def.element ?? null });
          e.tick += e.def.tickInterval;
        }
      }
      e.remaining -= dt;
      if (e.remaining <= 1e-9) {
        this.active.delete(id);
        expired.push(id);
        if (e.def.group && e.def.immunityAfter) this.immunity.set(e.def.group, e.def.immunityAfter);
      }
    }
    return { ticks, expired };
  }

  /** Strongest slow wins (no multiplicative stacking); disables/roots -> 0. */
  get speedMultiplier() {
    let m = 1;
    for (const e of this.active.values()) {
      if (e.def.kind === 'disable' || e.def.kind === 'root') return 0;
      if (e.def.kind === 'slow') m = Math.min(m, 1 - Math.min(0.9, e.potency));
    }
    return m;
  }

  get canMove() {
    for (const e of this.active.values()) if (e.def.kind === 'disable' || e.def.kind === 'root') return false;
    return true;
  }

  get canAct() {
    for (const e of this.active.values()) if (e.def.kind === 'disable') return false;
    return true;
  }

  list() {
    return [...this.active.values()].map((e) => ({ id: e.id, remaining: e.remaining, potency: e.potency }));
  }
}
