import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_KEY } from '../core/constants.js';
import { InputManager } from '../managers/InputManager.js';
import { RunManager } from '../managers/RunManager.js';
import { services } from '../core/services.js';
import { UI } from '../ui/theme.js';

const CARD_W = 118;
const CARD_H = 112;

/**
 * Level-up overlay (design doc 5.2). The DungeonScene is paused underneath.
 * Shows 3 random run buffs; exactly one can be chosen; it is applied
 * immediately. Handles several pending level-ups in a row.
 *
 * data: { returnTo: SceneKey }
 */
export class LevelUpScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.LEVEL_UP);
  }

  init(data) {
    this.returnTo = data.returnTo ?? SceneKeys.DUNGEON;
  }

  create() {
    this.input.setDefaultCursor('default');
    this.controls = new InputManager(this);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.78).setOrigin(0);
    this.title = this.add.bitmapText(GAME_WIDTH / 2, 34, FONT_KEY, '', 11).setOrigin(0.5).setScale(2).setTint(UI.accentHot);
    this.add.bitmapText(GAME_WIDTH / 2, 56, FONT_KEY, 'Choose one blessing for this run', 11).setOrigin(0.5).setTint(UI.textDim);
    this.hint = this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT - 22, FONT_KEY, 'A/D or click - choose     Enter - confirm', 11).setOrigin(0.5).setTint(UI.textDim);
    this.cards = [];
    this.controls.on('pressed', (a) => {
      if (!this.cards.length || this.locked) return;
      if (a === 'moveLeft') this.select((this.index + this.cards.length - 1) % this.cards.length);
      if (a === 'moveRight') this.select((this.index + 1) % this.cards.length);
      if (a === 'confirm') this.choose(this.index);
    });
    this.showChoices();
  }

  showChoices() {
    for (const c of this.cards) c.objects.forEach((o) => o.destroy());
    this.cards = [];
    this.locked = false;
    const run = services.run;
    this.title.setText(`LEVEL ${run.level - run.pendingLevelUps + 1}`);
    const choices = RunManager.rollChoices(this);
    this.choices = choices;
    if (!choices.length) {
      // every buff is maxed: consume the level-up and continue
      run.pendingLevelUps = Math.max(0, run.pendingLevelUps - 1);
      return this.finish();
    }
    const total = choices.length * CARD_W + (choices.length - 1) * 10;
    choices.forEach((def, i) => {
      const x = Math.round(GAME_WIDTH / 2 - total / 2 + i * (CARD_W + 10));
      const y = 74;
      const stacks = run.stacks(def.id);
      const g = this.add.graphics();
      const icon = this.add.image(x + CARD_W / 2, y + 26, 'icons', def.icon).setScale(2);
      const name = this.add.bitmapText(x + CARD_W / 2, y + 48, FONT_KEY, def.name, 11).setOrigin(0.5, 0).setTint(UI.text);
      const desc = this.add.bitmapText(x + CARD_W / 2, y + 62, FONT_KEY, def.description, 11).setOrigin(0.5, 0).setMaxWidth(CARD_W - 12).setCenterAlign().setTint(UI.textDim);
      const stack = this.add.bitmapText(x + CARD_W / 2, y + CARD_H - 13, FONT_KEY, `${stacks} -> ${stacks + 1} / ${def.maxStacks}`, 11).setOrigin(0.5, 0).setTint(UI.accent);
      const zone = this.add.zone(x, y, CARD_W, CARD_H).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.select(i));
      zone.on('pointerup', () => this.choose(i));
      const card = { x, y, g, def, objects: [g, icon, name, desc, stack, zone] };
      this.cards.push(card);
      card.objects.forEach((o) => { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 180, delay: i * 60 }); });
    });
    this.index = 0;
    this.select(0, true);
  }

  select(i, force = false) {
    if (i === this.index && !force) return;
    this.index = i;
    this.cards.forEach((c, k) => {
      const on = k === i;
      c.g.clear()
        .fillStyle(0x07060b).fillRect(c.x - 1, c.y - 1, CARD_W + 2, CARD_H + 2)
        .fillStyle(on ? UI.accent : UI.panelEdge).fillRect(c.x, c.y, CARD_W, CARD_H)
        .fillStyle(on ? 0x221a2c : UI.panel).fillRect(c.x + 1, c.y + 1, CARD_W - 2, CARD_H - 2);
      c.objects[1].setY(c.y + 26 - (on ? 2 : 0));
    });
  }

  choose(i) {
    if (this.locked) return;
    const def = this.choices[i];
    if (!def || !RunManager.chooseBuff(this, def.id)) return;
    this.locked = true;
    this.cameras.main.flash(120, 255, 220, 120);
    this.time.delayedCall(160, () => (services.run.pendingLevelUps > 0 ? this.showChoices() : this.finish()));
  }

  finish() {
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }

  update() {
    this.controls.update(); // gamepad buttons are polled
  }
}
