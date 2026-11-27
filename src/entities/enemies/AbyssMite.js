import { Enemy } from '../Enemy.js';

/**
 * Swarm AI: circles the player at a set radius with jittery motion, then
 * shivers (telegraph) and dashes straight through, body acting as a hitbox.
 */
export class AbyssMite extends Enemy {
  constructor(scene, x, y, def, ctx) {
    super(scene, x, y, def, ctx);
    this.orbitSign = Math.random() < 0.5 ? -1 : 1;
    this.cooldown = Math.random() * def.attack.cooldown; // desync the swarm
  }

  behaviourStates() {
    return {
      chase: { enter: () => this.playState('walk'), update: this.updateChase },
      windup: { enter: this.enterWindup, update: this.updateWindup, exit: () => this.clearTint() },
      dash: { enter: this.enterDash, update: this.updateDash },
      recover: { enter: () => this.showAttackFrame(3), update: this.updateRecover }
    };
  }

  get atk() {
    return this.def.attack;
  }

  updateChase(dt) {
    if (this.checkLostTarget()) return;
    const d = this.distanceTo(this.target);
    const c = this.body.center;
    const t = this.target.body.center;
    const los = this.ctx.nav.hasClearPath(c.x, c.y, t.x, t.y, this.body.halfWidth);
    this.playState('walk');
    if (this.cooldown <= 0 && d <= this.atk.triggerRange && los) return this.fsm.set('windup');
    if (!los || d > this.atk.orbitRadius * 1.6) return this.chase(this.speed, dt);
    // orbit: tangential motion + radial correction toward the orbit radius
    const dir = this.directionTo(this.target);
    const radial = (d - this.atk.orbitRadius) / this.atk.orbitRadius;
    let ox = -dir.y * this.orbitSign + dir.x * radial * 1.5;
    let oy = dir.x * this.orbitSign + dir.y * radial * 1.5;
    const len = Math.hypot(ox, oy) || 1;
    ox /= len;
    oy /= len;
    if (!this.ctx.nav.isWalkable(c.x + ox * 10, c.y + oy * 10)) this.orbitSign *= -1;
    this.steer(ox, oy, this.speed * 0.8, dt, 7);
  }

  enterWindup() {
    this.showAttackFrame(0);
    this.faceTarget();
  }

  updateWindup(dt) {
    this.stop(dt, 18);
    this.faceTarget();
    if (this.fsm.elapsed > this.atk.windup * 0.5) this.showAttackFrame(1);
    if (Math.floor(this.fsm.elapsed * 24) % 2) this.setTint(0xff7af2);
    else this.clearTint();
    if (this.fsm.elapsed >= this.atk.windup) this.fsm.set(this.targetAlive() ? 'dash' : 'idle');
  }

  enterDash() {
    const dir = this.directionTo(this.target);
    this.dashDir = dir;
    this.setFlipX(dir.x < 0);
    this.showAttackFrame(2);
    this.body.setVelocity(dir.x * this.atk.dashSpeed, dir.y * this.atk.dashSpeed);
    this.ctx.combat.spawnHitbox(this, { ...this.atk.hitbox, duration: this.atk.dashTime }, dir);
  }

  updateDash() {
    if (this.fsm.elapsed >= this.atk.dashTime) this.fsm.set('recover');
  }

  updateRecover(dt) {
    this.stop(dt, 6);
    if (this.fsm.elapsed >= this.atk.recover) {
      this.cooldown = this.atk.cooldown;
      this.orbitSign = Math.random() < 0.5 ? -1 : 1;
      this.fsm.set(this.targetAlive() ? 'chase' : 'idle');
    }
  }
}
