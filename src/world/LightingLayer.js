import Phaser from 'phaser';
import { DEPTH } from '../core/constants.js';
import { parseTiledColor } from '../core/math.js';

/**
 * Basic dungeon lighting: a multiply "ambient" layer darkens the world,
 * additive glows brighten around torches and the player. Cheap (a handful of
 * sprites), works in both WebGL and Canvas renderers. Full lighting pass is
 * planned for Phase 10.
 */
export class LightingLayer {
  constructor(scene, dungeonMap) {
    this.scene = scene;
    this.glows = [];

    this.ambient = scene.add
      .rectangle(0, 0, dungeonMap.widthInPixels, dungeonMap.heightInPixels, dungeonMap.ambientColor)
      .setOrigin(0)
      .setDepth(DEPTH.AMBIENT)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    for (const obj of dungeonMap.getObjects('Lights', 'torch')) this.addTorch(obj);
  }

  addTorch(obj) {
    const scene = this.scene;
    const torch = scene.add.sprite(obj.x, obj.y - 2, 'torch').setDepth(DEPTH.WALL_DECOR);
    torch.play({ key: 'torch_burn', startFrame: Phaser.Math.Between(0, 3) });
    const radius = obj.props.radius ?? 56;
    const glow = this.addGlow(obj.x, obj.y + 6, radius, parseTiledColor(obj.props.color, 0xffb060), 0.65);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.55, to: 0.75 },
      scale: { from: glow.scale * 0.96, to: glow.scale * 1.04 },
      duration: Phaser.Math.Between(160, 260),
      yoyo: true,
      repeat: -1,
      ease: 'Stepped',
      easeParams: [3],
      delay: Phaser.Math.Between(0, 200)
    });
  }

  addGlow(x, y, radius, color, alpha = 0.6) {
    const glow = this.scene.add
      .image(x, y, 'light_glow')
      .setDepth(DEPTH.LIGHTS)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color)
      .setAlpha(alpha)
      .setScale((radius * 2) / 64);
    this.glows.push(glow);
    return glow;
  }

  /** A light that tracks a game object every frame (e.g. the player). */
  attachLight(target, radius = 40, color = 0x9fb8ff, alpha = 0.35) {
    const glow = this.addGlow(target.x, target.y, radius, color, alpha);
    const sync = () => glow.setPosition(Math.round(target.x), Math.round(target.y - 6));
    this.scene.events.on('postupdate', sync);
    this.scene.events.once('shutdown', () => this.scene.events.off('postupdate', sync));
    return glow;
  }
}
