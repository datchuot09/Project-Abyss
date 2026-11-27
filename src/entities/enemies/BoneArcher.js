import Phaser from 'phaser';
import { DEPTH } from '../../core/constants.js';
import { Enemy } from '../Enemy.js';

/**
 * Ranged kiter AI: holds a preferred distance band, retreats along the flow
 * field when the player closes in, strafes while reloading, and aims with a
 * visible telegraph line before firing. Skill "Volley": every Nth shot is a
 * 3-arrow spread.
 */
export class BoneArcher extends Enemy {
  constructor(scene, x, y, def, ctx) {
    super(scene, x, y, def, ctx);
    this.engageState = 'engage';
    this.shots = 0;
    this.strafeSign = Math.random() < 0.5 ? -1 : 1;
    this.aimLine = scene.add.graphics().setDepth(DEPTH.ENTITIES + 1500);
  }

  behaviourStates() {
    return {
      engage: { enter: () => this.playState('walk'), update: this.updateEngage },
      retreat: { enter: () => this.playState('walk', { timeScale: 1.3 }), update: this.updateRetreat },
      aim: { enter: this.enterAim, update: this.updateAim, exit: () => this.aimLine.clear() },
      loose: { enter: this.enterLoose, update: this.updateLoose }
    };
  }

  get atk() {
    return this.def.attack;
  }

  hasShot() {
    const c = this.body.center;
    const t = this.target.body.center;
    return this.ctx.nav.hasLineOfSight(c.x, c.y - 4, t.x, t.y - 4);
  }

  updateEngage(dt) {
    if (this.checkLostTarget()) return;
    const d = this.distanceTo(this.target);
    const shot = this.hasShot();
    // Too close while reloading -> back off. Point blank with a shot ready -> fire anyway.
    if (d < this.atk.minRange && (this.cooldown > 0.2 || d >= this.atk.retreatRange)) return this.fsm.set('retreat');
    if (!shot || d > this.atk.maxRange) {
      this.playState('walk');
      return this.chase(this.speed, dt);
    }
    if (this.cooldown <= 0) return this.fsm.set('aim');
    // strafe sideways while reloading
    if (this.fsm.elapsed % 1.2 < dt) this.strafeSign *= -1;
    const dir = this.directionTo(this.target);
    const sx = -dir.y * this.strafeSign;
    const sy = dir.x * this.strafeSign;
    const c = this.body.center;
    if (this.ctx.nav.isWalkable(c.x + sx * 10, c.y + sy * 10)) this.steer(sx, sy, this.speed * 0.45, dt);
    else this.strafeSign *= -1;
    this.playState('walk');
    this.faceTarget();
  }

  updateRetreat(dt) {
    const d = this.distanceTo(this.target);
    const fled = this.flee(this.speed * 1.1, dt);
    this.faceTarget();
    if (!fled || d >= this.atk.minRange + 8 || this.fsm.elapsed > 1.2) {
      this.fsm.set(this.cooldown <= 0 && this.hasShot() ? 'aim' : 'engage');
    }
  }

  enterAim() {
    this.shots++;
    this.volley = this.def.skill && this.shots % this.def.skill.every === 0;
    this.showAttackFrame(0);
    this.aimDir = this.directionTo(this.target);
  }

  updateAim(dt) {
    this.stop(dt, 16);
    const t = this.fsm.elapsed;
    const lockAt = this.atk.aimTime - 0.15;
    if (t < lockAt && this.targetAlive()) this.aimDir = this.directionTo(this.target);
    this.setFlipX(this.aimDir.x < 0);
    if (t > this.atk.aimTime * 0.45) this.showAttackFrame(1);
    // telegraph line (flickers faster just before release)
    const c = this.body.center;
    const blink = t > lockAt ? Math.floor(t * 30) % 2 : 0;
    this.aimLine.clear().lineStyle(1, this.volley ? 0xffd24a : 0xff5a4a, blink ? 0.15 : 0.45)
      .lineBetween(c.x, c.y - 6, c.x + this.aimDir.x * 70, c.y - 6 + this.aimDir.y * 70);
    if (t >= this.atk.aimTime) this.fsm.set(this.targetAlive() ? 'loose' : 'idle');
  }

  enterLoose() {
    this.showAttackFrame(2);
    const c = this.body.center;
    const base = Math.atan2(this.aimDir.y, this.aimDir.x);
    const count = this.volley ? this.def.skill.arrows : 1;
    const spread = this.volley ? Phaser.Math.DegToRad(this.def.skill.spreadDeg) : 0;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * spread;
      this.ctx.projectiles.fire(this, this.atk.projectile, c.x + Math.cos(a) * 8, c.y - 6 + Math.sin(a) * 8, Math.cos(a), Math.sin(a), {
        multiplier: this.atk.multiplier, type: this.atk.type
      });
    }
  }

  updateLoose(dt) {
    this.stop(dt);
    if (this.fsm.elapsed > this.atk.recover * 0.5) this.showAttackFrame(3);
    if (this.fsm.elapsed >= this.atk.recover) {
      this.cooldown = this.atk.cooldown;
      this.fsm.set(this.targetAlive() ? 'engage' : 'idle');
    }
  }

  onInterrupted() {
    this.aimLine.clear();
  }

  onDeathCleanup() {
    this.aimLine.clear();
  }
}
