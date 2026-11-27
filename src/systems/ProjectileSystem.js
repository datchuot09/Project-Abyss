import Phaser from 'phaser';
import { DEPTH } from '../core/constants.js';
import { parseTiledColor } from '../core/math.js';

const MAX_PROJECTILES = 96;

/**
 * Pooled projectiles (design doc 19: object pooling). Projectiles are real
 * Arcade bodies: they collide with the wall layer and are tested against
 * opposing-team hurtboxes every frame.
 */
export class ProjectileSystem {
  constructor(scene, { combat, wallsLayer, effects, defs }) {
    this.scene = scene;
    this.combat = combat;
    this.effects = effects;
    this.defs = defs;
    this.group = scene.physics.add.group({ maxSize: MAX_PROJECTILES, allowGravity: false });
    this.spawnedTotal = 0;
    scene.physics.add.collider(this.group, wallsLayer, (p) => this.impact(p, true));
  }

  get activeCount() {
    return this.group.countActive(true);
  }

  /**
   * @param {object} owner combatant (team, stats, body)
   * @param {string} id     projectile definition id (data/skills/projectiles.json)
   * @param {object} spec   damage spec: multiplier, type, element
   */
  fire(owner, id, x, y, dirX, dirY, spec) {
    const def = this.defs[id];
    if (!def) throw new Error(`[Projectiles] Unknown projectile "${id}"`);
    const p = this.group.get(x, y, def.texture, 0);
    if (!p) return null; // pool exhausted – drop rather than allocate
    this.spawnedTotal++;
    // pooled sprites may have been a different projectile type before
    p.setTexture(def.texture, 0);
    p.setActive(true).setVisible(true).setDepth(DEPTH.ENTITIES + 2000);
    p.body.enable = true;
    p.body.setCircle(def.radius, p.width / 2 - def.radius, p.height / 2 - def.radius);
    p.body.reset(x, y);
    p.setVelocity(dirX * def.speed, dirY * def.speed);
    p.setRotation(def.rotate ? Math.atan2(dirY, dirX) : 0);
    if (def.anim) p.play(def.anim, true);
    p.owner = owner;
    p.def = def;
    p.spec = { knockback: def.knockback, hitstun: def.hitstun, ...spec };
    p.dir = { x: dirX, y: dirY };
    p.life = def.lifetime;
    p.trailColor = def.trailColor ? parseTiledColor(def.trailColor) : null;
    return p;
  }

  update(dt) {
    for (const p of this.group.getChildren()) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p);
        continue;
      }
      if (p.trailColor !== null) this.effects?.trail(p.x, p.y, p.trailColor);
      const r = p.def.radius;
      for (const target of this.combat.enemiesOf(p.owner.team)) {
        const b = target.body;
        const nx = Phaser.Math.Clamp(p.x, b.left, b.right);
        const ny = Phaser.Math.Clamp(p.y, b.top, b.bottom);
        if ((nx - p.x) ** 2 + (ny - p.y) ** 2 <= r * r) {
          const hit = this.combat.applyHit(p.owner, target, p.spec, p.dir, 'projectile');
          // an i-framed (evaded) target lets the projectile pass through
          if (hit) {
            this.impact(p, false);
            break;
          }
        }
      }
    }
  }

  impact(p, wall) {
    if (!p.active) return;
    this.effects?.impact(p.x, p.y, parseTiledColor(p.def.impactColor, 0xffffff), wall);
    this.release(p);
  }

  release(p) {
    p.anims?.stop();
    p.body.stop();
    p.body.enable = false;
    p.setActive(false).setVisible(false);
  }
}
