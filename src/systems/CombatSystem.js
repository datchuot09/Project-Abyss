import Phaser from 'phaser';
import { EventBus } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { calculateDamage } from './DamageCalculator.js';

/**
 * Hitbox / hurtbox resolution for melee attacks.
 *
 * A hitbox is a circle sector (radius + arc) attached to its owner. Every
 * frame it is tested against the *physics bodies* (hurtboxes) of all
 * opposing-team combatants: circle-vs-AABB intersection, then an angle test
 * for the arc. Each hitbox damages a given target at most once.
 *
 * Combatant contract: { team, body, stats, isTargetable(), receiveHit(hit) }
 */
export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.combatants = new Set();
    this.hitboxes = [];
    this.pool = [];
  }

  register(entity) {
    this.combatants.add(entity);
  }

  unregister(entity) {
    this.combatants.delete(entity);
  }

  enemiesOf(team) {
    const out = [];
    for (const c of this.combatants) if (c.team !== team && c.isTargetable()) out.push(c);
    return out;
  }

  /**
   * @param {object} owner combatant
   * @param {object} spec  { radius, arc (deg), offset, multiplier, type, element, knockback, hitstun, duration }
   * @param {{x:number,y:number}} dir unit vector the attack faces
   */
  spawnHitbox(owner, spec, dir, { follow = true } = {}) {
    const hb = this.pool.pop() ?? { hit: new Set() };
    hb.owner = owner;
    hb.spec = spec;
    hb.dirX = dir.x;
    hb.dirY = dir.y;
    hb.follow = follow;
    hb.time = spec.duration ?? 0.1;
    hb.hit.clear();
    const c = owner.body.center;
    hb.x = c.x + dir.x * (spec.offset ?? 0);
    hb.y = c.y + dir.y * (spec.offset ?? 0);
    hb.active = true;
    this.hitboxes.push(hb);
    this.resolve(hb); // first-frame test so very short hitboxes always register
    return hb;
  }

  /** Distance to the closest opposing combatant roughly in front of `owner` (within 60 deg). */
  nearestInFront(owner, dir, maxDist) {
    const c = owner.body.center;
    let best = Infinity;
    for (const t of this.enemiesOf(owner.team)) {
      const dx = t.body.center.x - c.x;
      const dy = t.body.center.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d > maxDist || d === 0) continue;
      if ((dx * dir.x + dy * dir.y) / d < 0.5) continue;
      best = Math.min(best, d);
    }
    return best;
  }

  cancelHitboxesOf(owner) {
    for (const hb of this.hitboxes) if (hb.owner === owner) hb.time = 0;
  }

  update(dt) {
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      const hb = this.hitboxes[i];
      hb.time -= dt;
      if (hb.time <= 0 || !hb.owner.active || hb.owner.isDead) {
        hb.active = false;
        this.hitboxes.splice(i, 1);
        this.pool.push(hb);
        continue;
      }
      if (hb.follow) {
        const c = hb.owner.body.center;
        hb.x = c.x + hb.dirX * (hb.spec.offset ?? 0);
        hb.y = c.y + hb.dirY * (hb.spec.offset ?? 0);
      }
      this.resolve(hb);
    }
  }

  resolve(hb) {
    const { radius, arc = 360 } = hb.spec;
    const halfArc = Phaser.Math.DegToRad(arc / 2);
    const facing = Math.atan2(hb.dirY, hb.dirX);
    for (const target of this.enemiesOf(hb.owner.team)) {
      if (hb.hit.has(target)) continue;
      const b = target.body;
      // circle vs AABB
      const nx = Phaser.Math.Clamp(hb.x, b.left, b.right);
      const ny = Phaser.Math.Clamp(hb.y, b.top, b.bottom);
      if ((nx - hb.x) ** 2 + (ny - hb.y) ** 2 > radius * radius) continue;
      if (arc < 360) {
        // A target overlapping the swing origin is always hit; otherwise its
        // centre must lie inside the arc.
        const overlapsOrigin = hb.x >= b.left - 2 && hb.x <= b.right + 2 && hb.y >= b.top - 2 && hb.y <= b.bottom + 2;
        const ang = Math.atan2(b.center.y - hb.y, b.center.x - hb.x);
        if (!overlapsOrigin && Math.abs(Phaser.Math.Angle.Wrap(ang - facing)) > halfArc) continue;
      }
      hb.hit.add(target);
      this.applyHit(hb.owner, target, hb.spec, { x: hb.dirX, y: hb.dirY }, 'melee');
    }
  }

  /** Single entry point for all damage (melee, projectiles, traps later). */
  applyHit(attacker, target, spec, dir, source = 'melee') {
    if (!target.isTargetable()) return null;
    if (target.isInvulnerable?.()) {
      EventBus.emit(Events.COMBAT_EVADED, { target, attacker, source });
      return null;
    }
    const dmg = calculateDamage({
      attacker: attacker.stats,
      defender: target.stats,
      multiplier: spec.multiplier ?? 1,
      type: spec.type ?? 'physical',
      element: spec.element ?? null
    });
    let kx = dir.x;
    let ky = dir.y;
    if (source === 'projectile' || (kx === 0 && ky === 0)) {
      const len = Math.hypot(kx, ky) || 1;
      kx /= len;
      ky /= len;
    }
    const hit = {
      attacker,
      source,
      team: attacker.team,
      ...dmg,
      knockback: { x: kx * (spec.knockback ?? 0), y: ky * (spec.knockback ?? 0) },
      hitstun: spec.hitstun ?? 0
    };
    const applied = target.receiveHit(hit);
    if (applied > 0) {
      EventBus.emit(Events.COMBAT_HIT, {
        target, attacker, damage: applied, crit: dmg.crit, type: dmg.type, element: dmg.element,
        x: target.body.center.x, y: target.body.top, team: target.team, source
      });
    }
    return hit;
  }

  destroy() {
    this.combatants.clear();
    this.hitboxes.length = 0;
    this.pool.length = 0;
  }
}
