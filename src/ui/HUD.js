import Phaser from 'phaser';
import { DEPTH, FONT_KEY } from '../core/constants.js';
import { listen } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { UI } from './theme.js';

const X = 6;
const Y = 6;
const BAR_X = X + 24;
const BAR_W = 84;
const BAR_H = 6;
const LOW_HP = 0.3;

/**
 * Top-left HUD (design doc section 5). Phase 2 ships the avatar + HP bar:
 * animated trailing damage, low-HP warning pulse. EXP and Stamina bars are
 * added under it in Phase 3. Reads only from events – no gameplay access.
 */
export class HUD {
  constructor(scene, player) {
    this.scene = scene;
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH.UI);

    // avatar frame + portrait cropped from the idle-down frame
    this.frame = fixed(scene.add.graphics());
    this.frame.fillStyle(0x07060b).fillRect(X - 1, Y - 1, 22, 22)
      .fillStyle(UI.panelEdge).fillRect(X, Y, 20, 20)
      .fillStyle(0x120f18).fillRect(X + 1, Y + 1, 18, 18);
    this.avatar = fixed(scene.add.image(X + 10, Y + 13, player.def.sprite.texture, 0).setCrop(4, 1, 16, 15));
    this.avatar.setOrigin(0.5, 0.5);

    this.bars = fixed(scene.add.graphics());
    this.label = fixed(scene.add.bitmapText(BAR_X, Y + 9, FONT_KEY, '', 11)).setTint(UI.text);

    this.max = player.health.max;
    this.value = player.health.current;
    this.trail = this.value; // white "damage taken" segment that drains
    this.flash = 0;
    listen(scene, Events.PLAYER_HP_CHANGED, this.onHp, this);
    this.draw();
  }

  onHp({ current, max, delta }) {
    this.max = max;
    this.value = current;
    if (delta > 0) this.trail = current;
    else this.flash = 0.15;
    this.draw();
  }

  update(dt) {
    let dirty = false;
    if (this.trail > this.value) {
      this.trail = Math.max(this.value, this.trail - this.max * 0.6 * dt);
      dirty = true;
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      dirty = true;
    }
    if (this.value / this.max <= LOW_HP && this.value > 0) dirty = true; // pulse
    if (dirty) this.draw();
  }

  draw() {
    const g = this.bars.clear();
    const ratio = Phaser.Math.Clamp(this.value / this.max, 0, 1);
    const trail = Phaser.Math.Clamp(this.trail / this.max, 0, 1);
    const low = ratio <= LOW_HP && ratio > 0;
    const pulse = low ? 0.5 + 0.5 * Math.sin(this.scene.time.now / 120) : 0;
    g.fillStyle(0x07060b).fillRect(BAR_X - 1, Y, BAR_W + 2, BAR_H + 2);
    g.fillStyle(0x2a0c12).fillRect(BAR_X, Y + 1, BAR_W, BAR_H);
    g.fillStyle(0xf2e6c8).fillRect(BAR_X, Y + 1, Math.round(BAR_W * trail), BAR_H);
    const fill = this.flash > 0 ? 0xffffff : low ? Phaser.Display.Color.GetColor(200 + 55 * pulse, 40, 60) : 0xc2304a;
    g.fillStyle(fill).fillRect(BAR_X, Y + 1, Math.round(BAR_W * ratio), BAR_H);
    g.fillStyle(0xff8a9a).fillRect(BAR_X, Y + 1, Math.round(BAR_W * ratio), 1); // highlight
    this.label.setText(`HP ${Math.ceil(this.value)}/${this.max}`).setTint(low ? 0xff8a8a : UI.text);
  }
}
