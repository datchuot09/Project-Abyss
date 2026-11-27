import Phaser from 'phaser';
import { DEPTH } from '../core/constants.js';
import { parseTiledColor } from '../core/math.js';
import { Health } from '../systems/Health.js';

/**
 * Shared base for anything that fights: physics body (= hurtbox), stats,
 * centralised Health, team, i-frames, shadow and y-sorting.
 *
 * Subclasses implement receiveHit(hit) and their own state machine.
 * ctx: { combat, projectiles, effects, nav, target }
 */
export class Combatant extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, def, team, ctx) {
    super(scene, x, y, def.sprite.texture, 0);
    this.def = def; // NB: `data` is reserved by Phaser's DataManager
    this.team = team;
    this.ctx = ctx;
    this.stats = { ...def.stats };
    this.health = new Health(this.stats.maxHp);
    this.iframeTime = 0;
    this.bloodColor = parseTiledColor(def.bloodColor, 0x7a1020);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(def.sprite.originX, def.sprite.originY);
    this.body.setSize(def.body.width, def.body.height, false);
    this.body.setOffset(def.body.offsetX, def.body.offsetY);
    this.setCollideWorldBounds(true);

    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.DECOR + 0.5);
    this.shadow.setScale((def.shadow?.width ?? 12) / 14, 1);

    this._sync = () => this.syncAttachments();
    scene.events.on('postupdate', this._sync);
    ctx.combat.register(this);
  }

  get isDead() {
    return this.health.isDead;
  }

  isTargetable() {
    return this.active && !this.health.isDead;
  }

  isInvulnerable() {
    return this.iframeTime > 0;
  }

  get center() {
    return this.body.center;
  }

  distanceTo(other) {
    return Phaser.Math.Distance.Between(this.body.center.x, this.body.center.y, other.body.center.x, other.body.center.y);
  }

  directionTo(other) {
    const dx = other.body.center.x - this.body.center.x;
    const dy = other.body.center.y - this.body.center.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  /** Exponential velocity approach toward (vx, vy). */
  approachVelocity(vx, vy, rate, dt) {
    const k = 1 - Math.exp(-rate * dt);
    const b = this.body.velocity;
    this.body.setVelocity(b.x + (vx - b.x) * k, b.y + (vy - b.y) * k);
  }

  applyKnockback(hit, scale = 1) {
    const resist = Phaser.Math.Clamp(this.stats.knockbackResist ?? 0, 0, 1);
    this.body.setVelocity(hit.knockback.x * (1 - resist) * scale, hit.knockback.y * (1 - resist) * scale);
  }

  syncAttachments() {
    if (!this.active) return;
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    this.setDepth(DEPTH.ENTITIES + this.y);
  }

  destroy(fromScene) {
    if (this.scene) this.scene.events.off('postupdate', this._sync);
    this.ctx?.combat.unregister(this);
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
