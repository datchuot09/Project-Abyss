// Pure per-run data (design doc 15.2): level, EXP, run buffs, stamina,
// floor, kills, stats. Lives in services.run across floors; discarded when
// the run ends (Game Over). Serialisable for the Phase 11 save system.
import { Stamina } from './Stamina.js';

export class RunState {
  constructor({ characterId, levelCurve, staminaConfig, staminaMax, now = Date.now() }) {
    this.characterId = characterId;
    this.levelCurve = levelCurve;
    this.level = 1;
    this.exp = 0;
    this.pendingLevelUps = 0;
    this.floor = 1;
    this.kills = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.buffs = {};
    this.startedAt = now;
    this.endedAt = null;
    this.stamina = new Stamina(staminaConfig, staminaMax ?? staminaConfig.max);
  }

  expToNext(level = this.level) {
    const { base, exponent } = this.levelCurve;
    return Math.round(base * Math.pow(level, exponent));
  }

  /** Returns the number of levels gained. */
  addExp(amount) {
    if (!(amount > 0)) return 0;
    this.exp += Math.round(amount);
    let gained = 0;
    const cap = this.levelCurve.maxLevel ?? 99;
    while (this.level < cap && this.exp >= this.expToNext()) {
      this.exp -= this.expToNext();
      this.level++;
      gained++;
    }
    if (this.level >= cap) this.exp = 0;
    this.pendingLevelUps += gained;
    return gained;
  }

  stacks(id) {
    return this.buffs[id] ?? 0;
  }

  canTakeBuff(def) {
    return this.stacks(def.id) < (def.maxStacks ?? Infinity);
  }

  addBuff(def) {
    if (!this.canTakeBuff(def)) return false;
    this.buffs[def.id] = this.stacks(def.id) + 1;
    return true;
  }

  /** Up to `count` distinct buffs not yet at max stacks, weighted random. */
  rollBuffChoices(defs, count = 3, rng = Math.random) {
    const pool = Object.values(defs).filter((d) => this.canTakeBuff(d));
    const out = [];
    while (out.length < count && pool.length) {
      const total = pool.reduce((s, d) => s + (d.weight ?? 1), 0);
      let r = rng() * total;
      let i = 0;
      for (; i < pool.length - 1; i++) {
        r -= pool[i].weight ?? 1;
        if (r < 0) break;
      }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  toJSON() {
    return {
      characterId: this.characterId, level: this.level, exp: this.exp, floor: this.floor, kills: this.kills,
      damageDealt: this.damageDealt, damageTaken: this.damageTaken, buffs: { ...this.buffs },
      stamina: this.stamina.current, startedAt: this.startedAt, endedAt: this.endedAt
    };
  }
}
