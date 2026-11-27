import { FONT_KEY, DEPTH } from '../core/constants.js';
import { UI } from './theme.js';

/**
 * Vertical pixel menu usable with keyboard, gamepad and mouse/touch.
 * Every item must have a real onSelect – no decorative buttons.
 *
 * items: [{ id, label: string | () => string, onSelect: () => void }]
 */
export class MenuList {
  constructor(scene, input, { x, y, items, spacing = 16, scale = 1 }) {
    this.scene = scene;
    this.input = input;
    this.items = items;
    this.index = 0;
    this.enabled = true;
    this.rows = items.map((item, i) => {
      const text = scene.add
        .bitmapText(x, y + i * spacing, FONT_KEY, '', 11)
        .setOrigin(0.5, 0)
        .setScale(scale)
        .setDepth(DEPTH.UI);
      const hit = scene.add
        .zone(x, y + i * spacing - 2, 200, spacing)
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH.UI);
      hit.on('pointerover', () => this.select(i));
      // pointerup (not pointerdown) so browser gestures like fullscreen work.
      hit.on('pointerup', () => this.activate(i));
      return { item, text, hit };
    });

    this._onPressed = (action) => {
      if (!this.enabled) return;
      if (action === 'moveUp') this.select((this.index - 1 + this.items.length) % this.items.length);
      else if (action === 'moveDown') this.select((this.index + 1) % this.items.length);
      else if (action === 'confirm') this.activate(this.index);
    };
    input.on('pressed', this._onPressed);
    scene.events.once('shutdown', () => input.off('pressed', this._onPressed));
    this.refresh();
  }

  select(i) {
    if (i === this.index) return;
    this.index = i;
    this.refresh();
  }

  activate(i) {
    if (!this.enabled) return;
    this.index = i;
    const row = this.rows[i];
    this.scene.tweens.add({ targets: row.text, y: row.text.y - 1, duration: 60, yoyo: true });
    row.item.onSelect();
    this.refresh();
  }

  refresh() {
    this.rows.forEach(({ item, text }, i) => {
      const label = typeof item.label === 'function' ? item.label() : item.label;
      const selected = i === this.index;
      text.setText(selected ? `> ${label} <` : label);
      text.setTint(selected ? UI.accentHot : UI.textDim);
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}
