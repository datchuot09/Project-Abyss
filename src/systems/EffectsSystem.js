import Phaser from 'phaser';
import { DEPTH, FONT_KEY } from '../core/constants.js';
import { listen } from '../core/EventBus.js';
import { Events } from '../core/Events.js';

const MAX_NUMBERS = 32;
const MAX_SPARKS = 16;
const MAX_SLASHES = 8;

const NUMBER_TINT = {
  physical: 0xf2ece0,
  magic: 0xc9b6ff,
  player: 0xff5a5a,
  crit: 0xffd24a
};

/**
 * Combat feedback: damage numbers, hit sparks, slash arcs, hit flash,
 * screen shake, death bursts, projectile trails. Everything is pooled.
 * Gameplay never calls this directly for damage – it listens to EventBus.
 */
export class EffectsSystem {
  constructor(scene) {
    this.scene = scene;
    this.numbers = [];
    this.sparks = [];
    this.slashes = [];

    this.burst = scene.add.particles(0, 0, 'px_white', {
      emitting: false,
      lifespan: { min: 250, max: 600 },
      speed: { min: 30, max: 110 },
      angle: { min: 0, max: 360 },
      scale: { start: 2, end: 0.5 },
      alpha: { start: 1, end: 0 },
      gravityY: 160
    }).setDepth(DEPTH.ENTITIES + 2500);

    this.trails = scene.add.particles(0, 0, 'px_white', {
      emitting: false,
      lifespan: 220,
      speed: { min: 0, max: 8 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      blendMode: Phaser.BlendModes.ADD
    }).setDepth(DEPTH.ENTITIES + 1999);

    listen(scene, Events.COMBAT_HIT, this.onHit, this);
    listen(scene, Events.COMBAT_EVADED, this.onEvaded, this);
    listen(scene, Events.ENTITY_DIED, this.onDied, this);
  }

  // ------------------------------------------------------------ pools
  take(pool, max, create) {
    let obj = pool.find((o) => !o.active);
    if (!obj && pool.length < max) {
      obj = create();
      pool.push(obj);
    }
    if (!obj) obj = pool.reduce((a, b) => (a.bornAt < b.bornAt ? a : b)); // recycle oldest
    obj.bornAt = this.scene.time.now;
    this.scene.tweens.killTweensOf(obj);
    return obj;
  }

  // ---------------------------------------------------------- numbers
  number(x, y, text, tint, big = false) {
    const t = this.take(this.numbers, MAX_NUMBERS, () => this.scene.add.bitmapText(0, 0, FONT_KEY, '', 11).setOrigin(0.5, 1));
    t.setActive(true).setVisible(true).setText(text).setTint(tint).setAlpha(1)
      .setPosition(Math.round(x + Phaser.Math.Between(-4, 4)), Math.round(y))
      .setDepth(DEPTH.ENTITIES + 3000)
      .setScale(big ? 2 : 1);
    this.scene.tweens.add({
      targets: t,
      y: t.y - (big ? 18 : 12),
      duration: big ? 520 : 420,
      ease: 'Cubic.easeOut',
      onComplete: () => this.scene.tweens.add({
        targets: t, alpha: 0, duration: 220, onComplete: () => t.setActive(false).setVisible(false)
      })
    });
  }

  spark(x, y, tint = 0xffffff) {
    const s = this.take(this.sparks, MAX_SPARKS, () => this.scene.add.sprite(0, 0, 'hit_spark'));
    s.setActive(true).setVisible(true).setPosition(x, y).setTint(tint).setDepth(DEPTH.ENTITIES + 2600)
      .setRotation(Phaser.Math.Between(0, 3) * (Math.PI / 4));
    s.play('hit_spark_burst');
    s.once('animationcomplete', () => s.setActive(false).setVisible(false));
  }

  /** Slash arc VFX aimed along `angle`; follows `owner` while it plays. */
  slash(owner, angle, { scale = 1, flipY = false, tint = 0xcfe6ff, distance = 10 } = {}) {
    const s = this.take(this.slashes, MAX_SLASHES, () => this.scene.add.sprite(0, 0, 'slash').setBlendMode(Phaser.BlendModes.ADD));
    s.setActive(true).setVisible(true).setRotation(angle).setFlipY(flipY).setScale(scale).setTint(tint).setAlpha(1);
    const place = () => {
      const c = owner.body.center;
      s.setPosition(Math.round(c.x + Math.cos(angle) * distance), Math.round(c.y - 3 + Math.sin(angle) * distance));
      s.setDepth(owner.depth + 1);
    };
    place();
    s.play('slash_swing');
    const sync = () => s.active && place();
    this.scene.events.on('postupdate', sync);
    s.once('animationcomplete', () => {
      this.scene.events.off('postupdate', sync);
      s.setActive(false).setVisible(false);
    });
  }

  trail(x, y, color) {
    this.trails.setParticleTint(color);
    this.trails.emitParticleAt(x, y, 1);
  }

  impact(x, y, color, wall) {
    this.burst.setParticleTint(color);
    this.burst.emitParticleAt(x, y, wall ? 5 : 8);
    this.spark(x, y, color);
  }

  shake(intensity = 0.003, duration = 90) {
    this.scene.cameras.main.shake(duration, intensity);
  }

  flash(sprite, color = 0xffffff, ms = 70) {
    if (!sprite.active) return;
    sprite.setTintFill(color);
    this.scene.time.delayedCall(ms, () => sprite.active && sprite.clearTint());
  }

  // ----------------------------------------------------------- events
  onHit({ target, damage, crit, type, x, y, team, source }) {
    const isPlayer = team === 'player';
    const tint = isPlayer ? NUMBER_TINT.player : crit ? NUMBER_TINT.crit : NUMBER_TINT[type] ?? NUMBER_TINT.physical;
    this.number(x, y - 2, crit ? `${damage}!` : `${damage}`, tint, crit && !isPlayer);
    this.flash(target, isPlayer ? 0xff4040 : 0xffffff);
    if (source === 'melee') this.spark(target.body.center.x, target.body.center.y - 4, crit ? NUMBER_TINT.crit : 0xffffff);
    if (isPlayer) this.shake(0.006, 140);
    else if (crit) this.shake(0.003, 80);
  }

  onEvaded({ target }) {
    if (target.team === 'player' && this.scene.time.now - (this._lastEvade ?? 0) > 400) {
      this._lastEvade = this.scene.time.now;
      this.number(target.x, target.y - 26, 'evade', 0x8ff0ff);
    }
  }

  onDied({ entity }) {
    if (entity.team === 'player') return;
    const c = entity.body?.center ?? entity;
    this.burst.setParticleTint(entity.bloodColor ?? 0x7a1020);
    this.burst.emitParticleAt(c.x, c.y - 4, 14);
  }
}
