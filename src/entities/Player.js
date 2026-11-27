import { EventBus } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { approachFactor } from '../core/math.js';
import { StateMachine } from '../systems/StateMachine.js';
import { Combatant } from './Combatant.js';

const DIR_VECTORS = { down: { x: 0, y: 1 }, up: { x: 0, y: -1 } };

/**
 * Player character. All tuning (stats, combo, dodge, cast, hitbox sizes,
 * animation rows) lives in public/data/characters/<id>.json.
 *
 * States: move -> attack (3-hit combo, buffered) / cast (arcane bolt) /
 *         dodge (i-frames, cancels attack recovery) / hit / dead
 */
export class Player extends Combatant {
  constructor(scene, x, y, character, ctx) {
    super(scene, x, y, character, 'player', ctx);
    this.id = character.id;
    this.movement = { acceleration: 14, deceleration: 18, runAfter: 0.45, runSpeedMultiplier: 1.3, ...character.movement };
    this.cfg = character.combat;
    this.facing = 'down';
    this.animState = 'idle';
    this.aim = { x: 0, y: 1 };
    this.moveTime = 0;
    this.comboIndex = 0;
    this.comboTimer = 0;
    this.attackBuffer = 0;
    this.dodgeCooldown = 0;
    this.castCooldown = 0;
    this.controls = null;

    this.health.onChange((e) => EventBus.emit(Events.PLAYER_HP_CHANGED, e));

    this.fsm = new StateMachine(this, {
      move: { update: this.stateMove },
      attack: { enter: this.enterAttack, update: this.updateAttack },
      cast: { enter: this.enterCast, update: this.updateCast },
      dodge: { enter: this.enterDodge, update: this.updateDodge, exit: () => this.setAlpha(1) },
      hit: { enter: this.enterHit, update: this.updateHit },
      dead: { enter: this.enterDead }
    }, 'move');
    this.playAnim('idle');
  }

  get moveSpeed() {
    return this.stats.movementSpeed;
  }

  get attackSpeed() {
    return Math.max(0.2, this.stats.attackSpeed ?? 1);
  }

  /** Called by DungeonScene every frame. */
  updateControl(input, dt) {
    this.controls = input;
    this.iframeTime = Math.max(0, this.iframeTime - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.castCooldown = Math.max(0, this.castCooldown - dt);
    // A press during a swing is kept until that swing ends (long finishers
    // must not swallow inputs); elsewhere it expires after inputBuffer.
    if (!this.fsm.is('attack')) this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0 && !this.fsm.is('attack')) this.comboIndex = 0;
    if (input.justPressed('attack')) this.attackBuffer = this.cfg.primary.inputBuffer;

    const c = this.body.center;
    this.aim = input.getAimVector(c.x, c.y) ?? this.facingVector();

    this.fsm.update(dt);

    // post-hit invulnerability blink (dodge i-frames are shown by the roll itself)
    if (!this.fsm.is('dodge', 'dead')) this.setAlpha(this.iframeTime > 0 && Math.floor(this.iframeTime * 16) % 2 ? 0.55 : 1);
  }

  // ------------------------------------------------------------------ helpers
  facingVector() {
    if (this.facing === 'side') return { x: this.flipX ? -1 : 1, y: 0 };
    return DIR_VECTORS[this.facing];
  }

  faceVector(x, y) {
    if (Math.abs(x) > Math.abs(y)) {
      this.facing = 'side';
      this.setFlipX(x < 0);
    } else {
      this.facing = y < 0 ? 'up' : 'down';
    }
  }

  updateFacingFromMove(x, y) {
    const diagonal = Math.abs(Math.abs(x) - Math.abs(y)) < 0.2;
    if (diagonal) {
      if (this.facing === 'side' && Math.sign(x) === (this.flipX ? -1 : 1)) return;
      if (this.facing === 'up' && y < 0) return;
      if (this.facing === 'down' && y > 0) return;
    }
    this.faceVector(x, y);
  }

  playAnim(state, { restart = false, timeScale = 1 } = {}) {
    this.animState = state;
    const key = `${this.id}_${state}_${this.facing}`;
    this.anims.timeScale = timeScale;
    this.play(key, !restart);
  }

  /** Scale an animation so its frames span exactly `seconds`. */
  playTimed(state, seconds) {
    const def = this.def.animations[state];
    const natural = def.frames.length / def.frameRate;
    this.playAnim(state, { restart: true, timeScale: natural / Math.max(0.05, seconds) });
  }

  wantsDodge() {
    return this.controls.justPressed('dodge') && this.dodgeCooldown <= 0;
  }

  // ------------------------------------------------------------------- states
  stateMove(dt) {
    const input = this.controls;
    if (this.wantsDodge()) return this.fsm.set('dodge');
    if (this.attackBuffer > 0) return this.fsm.set('attack');
    if (input.justPressed('secondary') && this.castCooldown <= 0) return this.fsm.set('cast');

    const move = input.getMoveVector();
    const moving = move.x !== 0 || move.y !== 0;
    this.moveTime = moving ? this.moveTime + dt : 0;
    const running = this.moveTime > this.movement.runAfter;
    const speed = this.moveSpeed * (running ? this.movement.runSpeedMultiplier : 1);
    const k = approachFactor(moving ? this.movement.acceleration : this.movement.deceleration, dt);
    let vx = this.body.velocity.x + (move.x * speed - this.body.velocity.x) * k;
    let vy = this.body.velocity.y + (move.y * speed - this.body.velocity.y) * k;
    if (!moving && Math.abs(vx) < 1) vx = 0;
    if (!moving && Math.abs(vy) < 1) vy = 0;
    this.body.setVelocity(vx, vy);

    if (moving) this.updateFacingFromMove(move.x, move.y);
    this.playAnim(moving ? (running ? 'run' : 'walk') : 'idle');
  }

  enterAttack() {
    this.attackBuffer = 0;
    const steps = this.cfg.primary.steps;
    this.step = steps[this.comboIndex % steps.length];
    this.attackDir = { ...this.aim };
    this.hitboxSpawned = false;
    this.faceVector(this.attackDir.x, this.attackDir.y);
    const as = this.attackSpeed;
    this.stepDuration = this.step.duration / as;
    this.playTimed('attack', this.stepDuration);
    // Step into the swing, but never through an enemy that is already in reach.
    const blocked = this.ctx.combat.nearestInFront(this, this.attackDir, 18) < Infinity;
    const lunge = blocked ? 0 : this.step.lunge;
    this.body.setVelocity(this.attackDir.x * lunge, this.attackDir.y * lunge);
    this.ctx.effects.slash(this, Math.atan2(this.attackDir.y, this.attackDir.x), {
      scale: this.step.slashScale, flipY: this.step.slashFlipY
    });
  }

  updateAttack(dt) {
    const t = this.fsm.elapsed;
    const as = this.attackSpeed;
    const s = this.step;
    this.approachVelocity(0, 0, 14, dt);
    if (!this.hitboxSpawned && t >= s.activeFrom / as) {
      this.hitboxSpawned = true;
      this.ctx.combat.spawnHitbox(this, { ...s, offset: 4, duration: (s.activeTo - s.activeFrom) / as }, this.attackDir);
    }
    // Dodge can cancel the recovery part of a swing (not the active frames).
    if (t >= s.activeTo / as && this.wantsDodge()) {
      this.advanceCombo();
      return this.fsm.set('dodge');
    }
    if (t >= this.stepDuration) {
      this.advanceCombo();
      this.fsm.set(this.attackBuffer > 0 ? 'attack' : 'move');
    }
  }

  advanceCombo() {
    this.comboIndex = (this.comboIndex + 1) % this.cfg.primary.steps.length;
    this.comboTimer = this.cfg.primary.comboWindow;
  }

  enterCast() {
    const c = this.cfg.secondary;
    this.castCooldown = c.cooldown;
    this.castDir = { ...this.aim };
    this.released = false;
    this.faceVector(this.castDir.x, this.castDir.y);
    this.playTimed('cast', c.castTime);
  }

  updateCast(dt) {
    const c = this.cfg.secondary;
    this.approachVelocity(0, 0, 12, dt);
    if (!this.released && this.fsm.elapsed >= c.releaseAt) {
      this.released = true;
      // aim may be refined during the short wind-up
      this.castDir = { ...this.aim };
      const o = this.body.center;
      this.ctx.projectiles.fire(this, c.projectile, o.x + this.castDir.x * 8, o.y - 6 + this.castDir.y * 8, this.castDir.x, this.castDir.y, {
        multiplier: c.multiplier, type: c.type, element: c.element
      });
    }
    if (this.wantsDodge() && this.released) return this.fsm.set('dodge');
    if (this.fsm.elapsed >= c.castTime) this.fsm.set('move');
  }

  enterDodge() {
    const d = this.cfg.dodge;
    const move = this.controls.getMoveVector();
    const len = Math.hypot(move.x, move.y);
    this.dodgeDir = len > 0 ? { x: move.x / len, y: move.y / len } : this.facingVector();
    this.updateFacingFromMove(this.dodgeDir.x, this.dodgeDir.y);
    this.dodgeCooldown = d.cooldown + d.duration;
    this.iframeTime = Math.max(this.iframeTime, d.iframes);
    this.attackBuffer = 0;
    this.comboIndex = 0;
    this.ctx.combat.cancelHitboxesOf(this);
    this.body.setVelocity(this.dodgeDir.x * d.speed, this.dodgeDir.y * d.speed);
    this.playTimed('dodge', d.duration);
  }

  updateDodge(dt) {
    const d = this.cfg.dodge;
    if (this.fsm.elapsed > d.duration * 0.7) this.approachVelocity(0, 0, 10, dt);
    if (this.fsm.elapsed >= d.duration) this.fsm.set('move');
  }

  enterHit(hit) {
    this.hitstun = Math.max(this.cfg.hurt.hitstun, Math.min(hit.hitstun, 0.4));
    this.applyKnockback(hit);
    this.ctx.combat.cancelHitboxesOf(this);
    this.attackBuffer = 0;
    this.comboIndex = 0;
    this.playAnim('hit', { restart: true });
  }

  updateHit(dt) {
    this.approachVelocity(0, 0, 9, dt);
    if (this.fsm.elapsed >= this.hitstun) this.fsm.set('move');
  }

  enterDead(hit) {
    this.body.setVelocity(hit ? hit.knockback.x * 0.5 : 0, hit ? hit.knockback.y * 0.5 : 0);
    this.body.setDrag(400, 400);
    this.ctx.combat.cancelHitboxesOf(this);
    this.setAlpha(1);
    this.playAnim('death', { restart: true });
    this.once('animationcomplete', () => EventBus.emit(Events.PLAYER_DIED, { player: this, killer: hit?.attacker }));
  }

  // ------------------------------------------------------------------ combat
  receiveHit(hit) {
    if (this.health.isDead || this.isInvulnerable()) return 0;
    const applied = this.health.damage(hit.amount, hit.attacker);
    if (applied <= 0) return 0;
    if (this.health.isDead) {
      this.fsm.set('dead', hit);
    } else {
      this.iframeTime = this.cfg.hurt.iframes;
      this.fsm.set('hit', hit);
    }
    return applied;
  }

  getDebugInfo() {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      vx: Math.round(this.body.velocity.x),
      vy: Math.round(this.body.velocity.y),
      facing: this.facing + (this.facing === 'side' ? (this.flipX ? '-L' : '-R') : ''),
      anim: this.animState,
      state: this.fsm.name,
      hp: `${this.health.current}/${this.health.max}`
    };
  }
}
