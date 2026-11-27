import { Enemy } from '../Enemy.js';

/**
 * Brute AI: relentless chaser. Telegraphs (0.45s, red flicker), then lunges
 * with super armor and a claw hitbox. Skill "Frenzy": once below 40% HP it
 * roars and becomes faster with shorter cooldowns.
 */
export class Ghoul extends Enemy {
  behaviourStates() {
    return {
      chase: { enter: () => this.playState('walk'), update: this.updateChase },
      windup: { enter: this.enterWindup, update: this.updateWindup, exit: () => this.clearTint() },
      lunge: { enter: this.enterLunge, update: this.updateLunge, exit: () => (this.superArmor = false) },
      recover: { enter: () => this.showAttackFrame(3), update: this.updateRecover },
      roar: { enter: this.enterRoar, update: this.updateRoar, exit: () => this.clearTint() }
    };
  }

  get atk() {
    return this.def.attack;
  }

  updateChase(dt) {
    if (this.checkLostTarget()) return;
    const skill = this.def.skill;
    if (!this.frenzied && skill && this.health.ratio <= skill.hpThreshold) return this.fsm.set('roar');
    const d = this.distanceTo(this.target);
    const c = this.body.center;
    const t = this.target.body.center;
    if (this.cooldown <= 0 && d <= this.atk.range && this.ctx.nav.hasLineOfSight(c.x, c.y, t.x, t.y)) {
      return this.fsm.set('windup');
    }
    this.playState('walk', { timeScale: this.speedMultiplier });
    if (d <= this.atk.range * 0.7) this.stop(dt);
    else this.chase(this.speed, dt);
  }

  enterWindup() {
    this.showAttackFrame(0);
    this.faceTarget();
  }

  updateWindup(dt) {
    this.stop(dt, 16);
    this.faceTarget();
    // telegraph: red flicker
    if (Math.floor(this.fsm.elapsed * 20) % 2) this.setTint(0xff6060);
    else this.clearTint();
    if (this.fsm.elapsed >= this.atk.windup) this.fsm.set(this.targetAlive() ? 'lunge' : 'idle');
  }

  enterLunge() {
    this.lungeDir = this.directionTo(this.target);
    this.setFlipX(this.lungeDir.x < 0);
    this.superArmor = true;
    this.showAttackFrame(1);
    this.body.setVelocity(this.lungeDir.x * this.atk.lungeSpeed, this.lungeDir.y * this.atk.lungeSpeed);
    this.ctx.combat.spawnHitbox(this, { ...this.atk.hitbox, duration: this.atk.lungeTime }, this.lungeDir);
  }

  updateLunge(dt) {
    if (this.fsm.elapsed > this.atk.lungeTime * 0.5) this.showAttackFrame(2);
    if (this.fsm.elapsed >= this.atk.lungeTime) this.fsm.set('recover');
  }

  updateRecover(dt) {
    this.stop(dt, 8);
    if (this.fsm.elapsed >= this.atk.recover) {
      this.cooldown = this.atk.cooldown * (this.frenzied ? this.def.skill.cooldownMultiplier : 1);
      this.fsm.set(this.targetAlive() ? 'chase' : 'idle');
    }
  }

  enterRoar() {
    this.frenzied = true;
    this.superArmor = true;
    this.showAttackFrame(0);
    this.ctx.effects.number(this.x, this.y - 26, 'ROAR', 0xff6a4a);
    this.ctx.effects.shake(0.003, 200);
  }

  updateRoar(dt) {
    this.stop(dt);
    this.setTint(Math.floor(this.fsm.elapsed * 12) % 2 ? 0xff4a3a : 0xffffff);
    if (this.fsm.elapsed >= this.def.skill.roarTime) {
      this.superArmor = false;
      this.speedMultiplier = this.def.skill.speedMultiplier;
      this.setTint(0xffb0a0); // lasting frenzy tint
      this.fsm.set('chase');
    }
  }

  clearTint() {
    if (this.frenzied && !this.fsm.is('roar')) return super.setTint(0xffb0a0);
    return super.clearTint();
  }
}
