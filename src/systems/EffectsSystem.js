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
  crit: 0xffd24a,
  dot: 0xb0ff80
};

const STATUS_COLORS = { burn: 0xff7a1a, poison: 0x7fd650, slow: 0x8fd8ff, freeze: 0xdff6ff, stun: 0xffe08a, root: 0x6aa84f };
const ELEMENT_COLORS = { fire: 0xff9a4a, nature: 0x9fe070, ice: 0x9fe8ff, shadow: 0xc49cff, arcane: 0xc9b6ff, holy: 0xfff0a0, lightning: 0xfff36a };

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

    this.blood_ = scene.add.particles(0, 0, 'px_white', {
      emitting: false,
      lifespan: { min: 300, max: 800 },
      speed: { min: 20, max: 90 },
      angle: { min: 200, max: 340 },
      scale: { start: 2, end: 1 },
      gravityY: 260,
      tint: [0x7a0d18, 0x5a0a12, 0xa0141f]
    }).setDepth(DEPTH.ENTITIES + 2400);
    this.statusTimer = 0;
    this.pools = scene.add.graphics().setDepth(DEPTH.DECOR + 0.6);
    this.bloodPools = [];
    this.afterimages = [];

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
    if (!sprite.active || sprite._frozenVisual) return;
    sprite.setTintFill(color);
    this.scene.time.delayedCall(ms, () => {
      if (!sprite.active) return;
      if (sprite._frozenVisual) sprite.setTint(0x9fe8ff);
      else sprite.clearTint();
    });
  }

  // ------------------------------------------------------- skill VFX
  afterimage(sprite, tint) {
    const g = this.take(this.afterimages, 12, () => this.scene.add.image(0, 0, sprite.texture.key).setBlendMode(Phaser.BlendModes.ADD));
    g.setActive(true).setVisible(true).setTexture(sprite.texture.key, sprite.frame.name).setOrigin(sprite.originX, sprite.originY)
      .setPosition(sprite.x, sprite.y).setFlipX(sprite.flipX).setTint(tint).setAlpha(0.6).setDepth(sprite.depth - 1);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.setActive(false).setVisible(false) });
  }

  /** Telegraphed rune on the floor; calls onDetonate after `delay` seconds. */
  sigil(x, y, radius, delay, onDetonate) {
    const img = this.scene.add.image(Math.round(x), Math.round(y), 'fx_sigil').setTint(0x9fe8ff).setDepth(DEPTH.DECOR + 0.7)
      .setScale(0.2).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD);
    const target = (radius * 2) / 48;
    this.scene.tweens.add({ targets: img, scale: target, angle: 60, duration: delay * 1000, ease: 'Cubic.easeOut' });
    this.scene.time.delayedCall(delay * 1000, () => {
      onDetonate?.();
      this.scene.tweens.add({ targets: img, alpha: 0, duration: 250, onComplete: () => img.destroy() });
    });
  }

  /** Expanding ring + particles; `big` adds a dark flash and heavy shake. */
  blast(x, y, radius, color, big = false) {
    const ring = this.scene.add.image(x, y, 'fx_ring').setTint(color).setDepth(DEPTH.ENTITIES + 2500)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
    this.scene.tweens.add({ targets: ring, scale: (radius * 2) / 64, alpha: { from: 1, to: 0 }, duration: big ? 450 : 300, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.burst.setParticleTint(color);
    this.burst.emitParticleAt(x, y, big ? 40 : 16);
    if (big) {
      const cam = this.scene.cameras.main;
      cam.flash(180, 60, 20, 90);
      this.shake(0.012, 320);
    } else this.shake(0.004, 100);
  }

  eclipseCharge(owner, radius, duration) {
    const c = owner.body.center;
    const ring = this.scene.add.image(c.x, c.y, 'fx_ring').setTint(0x7a3cc8).setDepth(DEPTH.ENTITIES + 2500)
      .setBlendMode(Phaser.BlendModes.ADD).setScale((radius * 2) / 64).setAlpha(0.2);
    this.scene.tweens.add({ targets: ring, scale: 0.3, alpha: 0.9, duration: duration * 1000, ease: 'Cubic.easeIn', onComplete: () => ring.destroy() });
    const dark = this.scene.add.rectangle(0, 0, 480, 270, 0x10041c, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.AMBIENT + 1);
    this.scene.tweens.add({ targets: dark, fillAlpha: 0.45, duration: duration * 1000, yoyo: true, hold: 120, onComplete: () => dark.destroy() });
  }

  /** Dark-fantasy blood: spray + a pool that spreads on the floor. */
  blood(x, y, intensity = 1) {
    this.blood_.emitParticleAt(x, y, Math.round(14 * intensity));
    let pool = this.bloodPools.find((p) => Math.hypot(p.x - x, p.y - (y + 6)) < 10);
    if (!pool) {
      pool = { x, y: y + 6, r: 2 };
      this.bloodPools.push(pool);
    }
    const target = Math.min(16, pool.r + 4 * intensity);
    this.scene.tweens.addCounter({
      from: pool.r, to: target, duration: 700,
      onUpdate: (tw) => { pool.r = tw.getValue(); this.drawPools(); }
    });
  }

  drawPools() {
    const g = this.pools.clear();
    for (const p of this.bloodPools) {
      g.fillStyle(0x3a0610, 0.9).fillEllipse(Math.round(p.x), Math.round(p.y), Math.round(p.r * 2), Math.round(p.r));
      g.fillStyle(0x6a0d18, 0.9).fillEllipse(Math.round(p.x - 1), Math.round(p.y - 1), Math.round(p.r * 1.2), Math.round(p.r * 0.5));
    }
  }

  /** Visual-only arrow used by the archer's execution finisher. */
  arrowShot(x0, y0, x1, y1, onHit) {
    const a = this.scene.add.image(x0, y0, 'arrow').setRotation(Math.atan2(y1 - y0, x1 - x0)).setDepth(DEPTH.ENTITIES + 2000);
    this.scene.tweens.add({ targets: a, x: x1, y: y1, duration: Math.max(80, Math.hypot(x1 - x0, y1 - y0) * 4), onComplete: () => onHit?.() });
  }

  levelUp(target) {
    const x = target.x;
    const y = target.y;
    this.burst.setParticleTint(0xffd24a);
    this.burst.emitParticleAt(x, y - 8, 24);
    const ring = this.scene.add.image(x, y - 4, 'fx_ring').setTint(0xffd24a).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.ENTITIES + 2500).setScale(0.2);
    this.scene.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
    this.number(x, y - 30, 'LEVEL UP', 0xffd24a, false);
  }

  /** Periodic particles above entities that carry status effects. */
  updateStatusVisuals(combatants, dt) {
    this.statusTimer -= dt;
    if (this.statusTimer > 0) return;
    this.statusTimer = 0.14;
    for (const c of combatants) {
      if (!c.isTargetable() || c.status.active.size === 0) continue;
      for (const id of c.status.active.keys()) {
        if (id === 'freeze') continue; // shown by the icy tint
        this.trails.setParticleTint(STATUS_COLORS[id] ?? 0xffffff);
        const ox = Phaser.Math.Between(-5, 5);
        this.trails.emitParticleAt(c.x + ox, id === 'stun' ? c.y - (c.height ?? 20) - 2 : c.y - 6 + Phaser.Math.Between(-6, 2), 1);
      }
    }
  }

  // ----------------------------------------------------------- events
  onHit({ target, damage, crit, type, element, x, y, team, source }) {
    const isPlayer = team === 'player';
    let tint = isPlayer ? NUMBER_TINT.player : crit ? NUMBER_TINT.crit : NUMBER_TINT[type] ?? NUMBER_TINT.physical;
    if (!isPlayer && element && ELEMENT_COLORS[element]) tint = ELEMENT_COLORS[element];
    if (source === 'dot') {
      this.number(x, y - 2, `${damage}`, isPlayer ? 0xff8a8a : ELEMENT_COLORS[element] ?? NUMBER_TINT.dot, false);
      return;
    }
    this.number(x, y - 2, crit ? `${damage}!` : `${damage}`, tint, crit && !isPlayer);
    this.flash(target, isPlayer ? 0xff4040 : 0xffffff);
    if (source === 'melee' || source === 'skill') this.spark(target.body.center.x, target.body.center.y - 4, crit ? NUMBER_TINT.crit : 0xffffff);
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
