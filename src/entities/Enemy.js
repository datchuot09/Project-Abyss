import Phaser from 'phaser';
import { DEPTH, FONT_KEY } from '../core/constants.js';
import { EventBus } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { StateMachine } from '../systems/StateMachine.js';
import { Combatant } from './Combatant.js';

const PERCEPTION_INTERVAL = 0.15;
const STUCK_CHECK = 0.5;
const SEPARATION_RADIUS = 13;

/**
 * Enemy base: perception, navigation steering, separation, stuck recovery,
 * HP bar and the AI states every monster shares:
 *   idle -> patrol -> alert (detect) -> [engage: subclass] ... hit / return / dead
 * Subclasses add their own engage/attack/skill/retreat states via
 * `behaviourStates()` and name their entry state in `engageState`.
 */
export class Enemy extends Combatant {
  constructor(scene, x, y, def, ctx) {
    super(scene, x, y, def, 'enemy', ctx);
    this.id = def.id;
    this.home = { x, y };
    this.target = ctx.target;
    this.rng = Math.random;
    this.cooldown = 0;
    this.superArmor = false;
    this.speedMultiplier = 1;
    this.canSee = false;
    this.lastSeenAt = 0;
    this.perceptionTimer = Math.random() * PERCEPTION_INTERVAL; // stagger work across frames
    this.stuck = { timer: 0, lastX: x, lastY: y, forceFlow: 0 };
    this.wantsToMove = false;
    this.engageState = 'chase';

    this.hpBar = scene.add.graphics().setDepth(DEPTH.ENTITIES + 2800).setVisible(false);
    this.hpBarTimer = 0;
    this.alertIcon = scene.add.bitmapText(x, y, FONT_KEY, '!', 11).setOrigin(0.5, 1).setTint(0xff5a4a).setVisible(false);

    this.fsm = new StateMachine(this, {
      idle: { enter: this.enterIdle, update: this.updateIdle },
      patrol: { enter: this.enterPatrol, update: this.updatePatrol },
      alert: { enter: this.enterAlert, update: this.updateAlert, exit: () => this.alertIcon.setVisible(false) },
      return: { update: this.updateReturn },
      hit: { enter: this.enterHit, update: this.updateHit },
      dead: { enter: this.enterDead },
      finisher: { enter: this.enterFinisher, update: this.updateFinisher },
      ...this.behaviourStates()
    }, 'idle');
  }

  /** Override: return extra states. */
  behaviourStates() {
    return {};
  }

  get perception() {
    return this.def.perception;
  }

  get speed() {
    return this.stats.movementSpeed * this.speedMultiplier * this.status.speedMultiplier;
  }

  playState(state, { restart = false, timeScale = 1 } = {}) {
    this.anims.timeScale = timeScale;
    this.play(`${this.id}_${state}`, !restart);
  }

  /** Show a specific column of the attack row (manual frame control for telegraphs). */
  showAttackFrame(i) {
    this.anims.stop();
    this.setFrame(this.def.animations.attack.frames[i]);
  }

  // ------------------------------------------------------------- perception
  targetAlive() {
    return this.target && this.target.isTargetable();
  }

  perceive(dt) {
    this.perceptionTimer -= dt;
    if (this.perceptionTimer > 0) return this.canSee;
    this.perceptionTimer = PERCEPTION_INTERVAL;
    if (!this.targetAlive()) return (this.canSee = false);
    const d = this.distanceTo(this.target);
    const a = this.body.center;
    const b = this.target.body.center;
    const inRange = d <= (this.fsm.is('idle', 'patrol', 'return') ? this.perception.detectRange : this.perception.loseRange);
    this.canSee = (inRange && this.ctx.nav.hasLineOfSight(a.x, a.y, b.x, b.y)) || d <= this.perception.hearingRange;
    if (this.canSee) this.lastSeenAt = this.scene.time.now;
    return this.canSee;
  }

  /** Called when damaged or when an ally spots the player. */
  aggro() {
    if (!this.targetAlive() || this.fsm.is('dead')) return;
    this.lastSeenAt = this.scene.time.now;
    if (this.fsm.is('idle', 'patrol', 'return')) this.fsm.set('alert');
  }

  // --------------------------------------------------------------- movement
  separation() {
    let sx = 0;
    let sy = 0;
    const c = this.body.center;
    for (const other of this.ctx.combat.combatants) {
      if (other === this || other.team !== 'enemy' || !other.isTargetable()) continue;
      const dx = c.x - other.body.center.x;
      const dy = c.y - other.body.center.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < SEPARATION_RADIUS * SEPARATION_RADIUS) {
        const d = Math.sqrt(d2);
        sx += (dx / d) * (1 - d / SEPARATION_RADIUS);
        sy += (dy / d) * (1 - d / SEPARATION_RADIUS);
      }
    }
    return { x: sx, y: sy };
  }

  /** Steer with velocity `dir * speed` plus separation, smoothing with `accel`. */
  steer(dirX, dirY, speed, dt, accel = 10) {
    const sep = this.separation();
    let vx = dirX * speed + sep.x * speed * 0.8;
    let vy = dirY * speed + sep.y * speed * 0.8;
    const len = Math.hypot(vx, vy);
    if (len > speed && len > 0) {
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;
    }
    this.wantsToMove = speed > 0 && (dirX !== 0 || dirY !== 0);
    this.approachVelocity(vx, vy, accel, dt);
    if (Math.abs(vx) > 2) this.setFlipX(vx < 0);
  }

  stop(dt, rate = 12) {
    this.wantsToMove = false;
    this.approachVelocity(0, 0, rate, dt);
  }

  faceTarget() {
    if (this.targetAlive()) this.setFlipX(this.target.body.center.x < this.body.center.x);
  }

  /** Move toward a world point we know is directly reachable. Returns true when arrived. */
  moveDirect(x, y, speed, dt) {
    const c = this.body.center;
    const dx = x - c.x;
    const dy = y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) {
      this.stop(dt);
      return true;
    }
    this.steer(dx / d, dy / d, speed, dt);
    return false;
  }

  /** Chase the player: straight line when the path is clear, flow field otherwise. */
  chase(speed, dt) {
    const c = this.body.center;
    const t = this.target.body.center;
    const nav = this.ctx.nav;
    let wp = null;
    if (this.stuck.forceFlow <= 0 && nav.hasClearPath(c.x, c.y, t.x, t.y, this.body.halfWidth + 1)) wp = t;
    else wp = nav.nextWaypoint(c.x, c.y) ?? t;
    const dx = wp.x - c.x;
    const dy = wp.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    this.steer(dx / d, dy / d, speed, dt);
  }

  /** Step away from the player along the flow field. Returns false if cornered. */
  flee(speed, dt) {
    const c = this.body.center;
    const wp = this.ctx.nav.nextWaypoint(c.x, c.y, true);
    if (!wp) return false;
    const dx = wp.x - c.x;
    const dy = wp.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    this.steer(dx / d, dy / d, speed, dt);
    return true;
  }

  /** If we keep trying to move but do not, route via tile centres for a while. */
  updateStuck(dt) {
    const s = this.stuck;
    s.forceFlow = Math.max(0, s.forceFlow - dt);
    s.timer += dt;
    if (s.timer < STUCK_CHECK) return;
    const moved = Math.hypot(this.x - s.lastX, this.y - s.lastY);
    if (this.wantsToMove && moved < 2) {
      s.forceFlow = 1.2;
      this.stuckEvents = (this.stuckEvents ?? 0) + 1;
    }
    s.timer = 0;
    s.lastX = this.x;
    s.lastY = this.y;
  }

  // ------------------------------------------------------------------ think
  think(dt) {
    if (!this.active) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.iframeTime = Math.max(0, this.iframeTime - dt);
    if (!this.fsm.is('dead')) {
      this.updateStatus(dt);
      if (!this.active || this.fsm.is('dead')) return; // killed by a DoT tick
      // Frozen / stunned: no thinking, no moving (timers above still run)
      if (!this.status.canAct) {
        this.stop(dt, 20);
        this.hpBarTimer = Math.max(this.hpBarTimer, 0.5);
        return;
      }
      this.perceive(dt);
      // the player died: calm down (unless performing the death finisher)
      if (!this.targetAlive() && !this.fsm.is('idle', 'patrol', 'return', 'hit', 'finisher')) this.fsm.set('idle');
    }
    this.fsm.update(dt);
    this.updateStuck(dt);
    this.hpBarTimer = Math.max(0, this.hpBarTimer - dt);
  }

  // ----------------------------------------------------------------- shared states
  enterIdle() {
    this.idleFor = Phaser.Math.FloatBetween(this.def.patrol.idleMin, this.def.patrol.idleMax);
    this.playState('idle');
  }

  updateIdle(dt) {
    this.stop(dt);
    if (this.canSee) return this.fsm.set('alert');
    if (this.fsm.elapsed > this.idleFor) this.fsm.set('patrol');
  }

  enterPatrol() {
    const tiles = Math.max(1, Math.round(this.def.patrol.radius / 16));
    this.patrolPoint = this.ctx.nav.randomReachablePoint(this.home.x, this.home.y - 4, tiles, this.rng, this.body.halfWidth + 1);
    if (this.patrolPoint) {
      const c = this.body.center;
      if (!this.ctx.nav.hasClearPath(c.x, c.y, this.patrolPoint.x, this.patrolPoint.y, this.body.halfWidth + 1)) this.patrolPoint = null;
    }
    this.playState('walk');
  }

  updatePatrol(dt) {
    if (this.canSee) return this.fsm.set('alert');
    if (!this.patrolPoint) return this.fsm.set('idle');
    const arrived = this.moveDirect(this.patrolPoint.x, this.patrolPoint.y, this.speed * this.def.patrol.speedMultiplier, dt);
    if (arrived || this.fsm.elapsed > 4) this.fsm.set('idle');
  }

  enterAlert() {
    this.alertIcon.setVisible(true);
    this.faceTarget();
    this.playState('idle');
    // shout: nearby idle allies join in
    for (const other of this.ctx.combat.combatants) {
      if (other !== this && other.team === 'enemy' && other.aggro && this.distanceTo(other) < 90) other.aggro();
    }
  }

  updateAlert(dt) {
    this.stop(dt);
    this.alertIcon.setPosition(Math.round(this.x), Math.round(this.y - this.def.hpBar.offsetY - 2));
    if (!this.targetAlive()) return this.fsm.set('idle');
    if (this.fsm.elapsed >= this.perception.reactionTime) this.fsm.set(this.engageState);
  }

  /** Subclasses call this from their engage state; returns true if it changed state. */
  checkLostTarget() {
    if (!this.targetAlive()) {
      this.fsm.set('idle');
      return true;
    }
    // Give up only if the player has been out of sight for a while AND is far
    // away by walking distance (not straight-line distance through walls).
    const unseen = (this.scene.time.now - this.lastSeenAt) / 1000;
    const c = this.body.center;
    const walkDist = this.ctx.nav.pathDistance(c.x, c.y) * 16;
    if (!this.canSee && unseen > 3 && walkDist > this.perception.loseRange * 1.5) {
      this.fsm.set('return');
      return true;
    }
    return false;
  }

  updateReturn(dt) {
    if (this.canSee) return this.fsm.set('alert');
    const c = this.body.center;
    if (!this.ctx.nav.hasClearPath(c.x, c.y, this.home.x, this.home.y - 4, this.body.halfWidth + 1) || this.fsm.elapsed > 6) {
      this.home = { x: this.x, y: this.y }; // settle here instead of getting lost
      return this.fsm.set('idle');
    }
    this.playState('walk');
    if (this.moveDirect(this.home.x, this.home.y - 4, this.speed * 0.6, dt)) this.fsm.set('idle');
  }

  enterHit(hit) {
    this.hitstun = hit.hitstun;
    this.applyKnockback(hit);
    this.playState('hit', { restart: true });
  }

  updateHit(dt) {
    this.approachVelocity(0, 0, 8, dt);
    if (this.fsm.elapsed >= this.hitstun) this.fsm.set(this.targetAlive() ? this.engageState : 'idle');
  }

  enterDead(hit) {
    this.ctx.combat.cancelHitboxesOf(this);
    this.alertIcon.setVisible(false);
    this.hpBar.setVisible(false);
    this.onDeathCleanup?.();
    if (hit) this.body.setVelocity(hit.knockback.x * 0.6, hit.knockback.y * 0.6);
    this.body.setDrag(500, 500);
    this.playState('death', { restart: true });
    EventBus.emit(Events.ENTITY_DIED, { entity: this, team: this.team, killer: hit?.attacker });
    this.scene.time.delayedCall(450, () => this.body && (this.body.enable = false));
    this.scene.tweens.add({ targets: [this, this.shadow], alpha: 0, delay: 2200, duration: 600, onComplete: () => this.destroy() });
  }

  // ------------------------------------------------------------------ combat
  // ------------------------------------------------------------ death finisher
  /**
   * Design doc 5.4: the monster that killed the player performs a finisher
   * that fits its type. Emits FINISHER_DONE when finished.
   */
  startFinisher(victim) {
    if (!this.isTargetable()) return false;
    this.finisherVictim = victim;
    this.status.clear();
    this.refreshStatusVisual();
    this.fsm.set('finisher');
    return true;
  }

  enterFinisher() {
    this.superArmor = true;
    this.finisherStep = 0;
    this.finisherTimer = 0;
    this.finisherPhase = this.def.finisher?.type === 'execute_shot' ? 'act' : 'approach';
    this.playState('walk');
  }

  updateFinisher(dt) {
    const v = this.finisherVictim;
    const f = this.def.finisher ?? { type: 'maul', strikes: 2 };
    const fx = this.ctx.effects;
    const vc = { x: v.x, y: v.y - 4 };
    if (this.finisherPhase === 'approach') {
      const side = this.x < v.x ? -1 : 1;
      const arrived = this.moveDirect(v.x + side * 10, v.y - 2, this.stats.movementSpeed * 1.2, dt);
      if (arrived || this.fsm.elapsed > 1.6) {
        this.finisherPhase = 'act';
        this.finisherTimer = 0;
        this.stop(dt, 30);
        this.setFlipX(v.x < this.x);
      }
      return;
    }
    this.stop(dt, 30);
    this.finisherTimer += dt;
    if (f.type === 'execute_shot') {
      this.setFlipX(v.x < this.x);
      if (this.finisherStep === 0) { this.showAttackFrame(0); this.finisherStep = 1; }
      if (this.finisherStep === 1 && this.finisherTimer > 0.35) { this.showAttackFrame(1); this.finisherStep = 2; }
      if (this.finisherStep === 2 && this.finisherTimer > 0.9) {
        this.showAttackFrame(2);
        this.finisherStep = 3;
        const c = this.body.center;
        fx.arrowShot(c.x, c.y - 6, vc.x, vc.y, () => fx.blood(vc.x, vc.y, 1.4));
      }
      if (this.finisherStep === 3 && this.finisherTimer > 1.6) this.endFinisher();
      return;
    }
    // maul (ghoul) / burrow (mite): repeated strikes on the body
    const period = f.type === 'burrow' ? 0.32 : 0.26;
    const strikes = f.strikes ?? 2;
    const k = Math.floor(this.finisherTimer / period);
    if (k > this.finisherStep && this.finisherStep < strikes * 2) {
      this.finisherStep = k;
      const striking = k % 2 === 1;
      this.showAttackFrame(striking ? 2 : 1);
      if (striking) {
        fx.blood(vc.x, vc.y, f.type === 'burrow' ? 0.9 : 1.2);
        fx.shake(0.002, 60);
      }
    }
    if (this.finisherTimer > period * (strikes * 2 + 1)) this.endFinisher();
  }

  endFinisher() {
    if (this.finisherDone) return;
    this.finisherDone = true;
    this.superArmor = false;
    this.playState('idle');
    this.fsm.set('idle');
    EventBus.emit(Events.FINISHER_DONE, { by: this });
  }

  receiveHit(hit) {
    if (this.health.isDead || (!hit.dot && this.isInvulnerable())) return 0;
    const applied = this.health.damage(hit.amount, hit.attacker);
    if (applied <= 0) return 0;
    this.hpBarTimer = 3;
    if (this.health.isDead) {
      this.status.clear();
      this.refreshStatusVisual();
      this.fsm.set('dead', hit);
      return applied;
    }
    if (hit.dot) return applied;
    this.aggro();
    if (this.fsm.is('idle', 'patrol', 'return', 'alert')) this.lastSeenAt = this.scene.time.now;
    if (this.superArmor) this.applyKnockback(hit, 0.25);
    else if (hit.hitstun > 0) {
      this.onInterrupted?.();
      this.fsm.set('hit', hit);
    }
    return applied;
  }

  syncAttachments() {
    super.syncAttachments();
    if (!this.active) return;
    const show = this.hpBarTimer > 0 && !this.health.isDead;
    this.hpBar.setVisible(show);
    if (show) {
      const w = this.def.hpBar.width;
      const x = Math.round(this.x - w / 2);
      const y = Math.round(this.y - this.def.hpBar.offsetY);
      const fill = Math.max(1, Math.round(w * this.health.ratio));
      this.hpBar.clear().fillStyle(0x07060b).fillRect(x - 1, y - 1, w + 2, 4)
        .fillStyle(0x3a0d14).fillRect(x, y, w, 2)
        .fillStyle(this.health.ratio > 0.35 ? 0xd9455f : 0xff8a3a).fillRect(x, y, fill, 2);
    }
  }

  getDebugInfo() {
    return { id: this.id, state: this.fsm.name, hp: this.health.current, x: Math.round(this.x), y: Math.round(this.y) };
  }

  destroy(fromScene) {
    this.hpBar?.destroy();
    this.alertIcon?.destroy();
    this.aimLine?.destroy();
    super.destroy(fromScene);
  }
}
