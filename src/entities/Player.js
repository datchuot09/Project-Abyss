import Phaser from 'phaser';
import { DEPTH } from '../core/constants.js';
import { approachFactor } from '../core/math.js';

/**
 * Player character. Everything character-specific (stats, sprite, hitbox,
 * animation rows) comes from public/data/characters/<id>.json, so new
 * characters are data + art, not new code.
 *
 * Phase 1 scope: movement, facing, idle/walk animation, wall collision.
 * Combat states (attack, dodge, hit, death) arrive in Phase 2.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, character) {
    super(scene, x, y, character.sprite.texture, 0);
    this.character = character;
    this.id = character.id;
    this.stats = { ...character.stats };
    this.movement = { acceleration: 14, deceleration: 18, ...character.movement };
    this.facing = 'down';
    this.animState = 'idle';

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(character.sprite.originX, character.sprite.originY);
    const b = character.body;
    this.body.setSize(b.width, b.height, false);
    this.body.setOffset(b.offsetX, b.offsetY);
    this.setCollideWorldBounds(true);
    this.playAnim('idle');
  }

  get moveSpeed() {
    return this.stats.movementSpeed;
  }

  /** @param {import('../managers/InputManager.js').InputManager} input */
  updateControl(input, dt) {
    const move = input.getMoveVector();
    const targetX = move.x * this.moveSpeed;
    const targetY = move.y * this.moveSpeed;
    const moving = move.x !== 0 || move.y !== 0;
    const k = approachFactor(moving ? this.movement.acceleration : this.movement.deceleration, dt);
    let vx = this.body.velocity.x + (targetX - this.body.velocity.x) * k;
    let vy = this.body.velocity.y + (targetY - this.body.velocity.y) * k;
    if (!moving && Math.abs(vx) < 1) vx = 0;
    if (!moving && Math.abs(vy) < 1) vy = 0;
    this.body.setVelocity(vx, vy);

    if (moving) this.updateFacing(move.x, move.y);
    this.playAnim(moving ? 'walk' : 'idle');
    this.setDepth(DEPTH.ENTITIES + this.y);
  }

  updateFacing(x, y) {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    // Diagonal hysteresis: keep the current facing if it is one of the two
    // components, so diagonal walking does not flicker between sprites.
    const diagonal = Math.abs(ax - ay) < 0.2;
    if (diagonal) {
      if (this.facing === 'side' && Math.sign(x) === (this.flipX ? -1 : 1)) return;
      if (this.facing === 'up' && y < 0) return;
      if (this.facing === 'down' && y > 0) return;
    }
    if (ax > ay) {
      this.facing = 'side';
      this.setFlipX(x < 0);
    } else {
      this.facing = y < 0 ? 'up' : 'down';
    }
  }

  playAnim(state) {
    this.animState = state;
    this.play(`${this.id}_${state}_${this.facing}`, true);
  }

  getDebugInfo() {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      vx: Math.round(this.body.velocity.x),
      vy: Math.round(this.body.velocity.y),
      facing: this.facing + (this.facing === 'side' ? (this.flipX ? '-L' : '-R') : ''),
      anim: this.animState
    };
  }
}
