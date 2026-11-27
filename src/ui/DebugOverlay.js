import Phaser from 'phaser';
import { DEPTH, FONT_KEY } from '../core/constants.js';
import { services } from '../core/services.js';

/**
 * F3 developer overlay: FPS, renderer, scale, player state, tile, and Arcade
 * physics hitboxes. Purely diagnostic – not part of the player HUD.
 */
export class DebugOverlay {
  constructor(scene, { player, map, input }) {
    this.scene = scene;
    this.player = player;
    this.map = map;
    this.input = input;
    this.bg = scene.add.rectangle(2, 268, 170, 82, 0x000000, 0.55).setOrigin(0, 1).setScrollFactor(0).setDepth(DEPTH.DEBUG);
    this.text = scene.add.bitmapText(5, 189, FONT_KEY, '', 11).setScrollFactor(0).setDepth(DEPTH.DEBUG).setTint(0x9dffb0);
    this.visible = Boolean(services.settings?.get('video.showDebug'));
    this.apply();
  }

  toggle() {
    this.visible = !this.visible;
    services.settings?.set('video.showDebug', this.visible);
    this.apply();
  }

  apply() {
    this.bg.setVisible(this.visible);
    this.text.setVisible(this.visible);
    const world = this.scene.physics.world;
    if (this.visible && !world.debugGraphic) world.createDebugGraphic();
    world.drawDebug = this.visible;
    if (world.debugGraphic) {
      world.debugGraphic.clear();
      world.debugGraphic.setVisible(this.visible);
      world.debugGraphic.setDepth(DEPTH.DEBUG - 1);
    }
  }

  update() {
    if (!this.visible) return;
    const game = this.scene.game;
    const d = services.display?.state;
    const p = this.player.getDebugInfo();
    const t = this.map.worldToTile(this.player.x, this.player.y);
    const renderer = game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas';
    this.text.setText([
      `FPS ${Math.round(game.loop.actualFps)}  ${renderer}`,
      `Scale x${d ? +d.physicalScale.toFixed(2) : '?'} ${d?.mode ?? ''}${d?.integer ? '' : ' (frac)'}`,
      `Pos ${p.x},${p.y}  Tile ${t.tx},${t.ty}`,
      `Vel ${p.vx},${p.vy}  ${p.facing}`,
      `State ${p.state}  HP ${p.hp}`,
      `Enemies ${this.scene.aliveEnemies?.length ?? 0}  Proj ${this.scene.projectiles?.activeCount ?? 0}`,
      `Input ${this.input.lastDevice}`
    ]);
  }
}
