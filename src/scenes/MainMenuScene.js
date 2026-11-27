import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { GAME_WIDTH, GAME_HEIGHT, GAME_TITLE, GAME_VERSION, BUILD_PHASE, FONT_KEY, DEPTH } from '../core/constants.js';
import { SceneRouter } from '../core/SceneRouter.js';
import { services } from '../core/services.js';
import { listen } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { InputManager } from '../managers/InputManager.js';
import { MenuList } from '../ui/MenuList.js';
import { RunManager } from '../managers/RunManager.js';
import { UI } from '../ui/theme.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.MAIN_MENU);
  }

  create() {
    SceneRouter.enter(this);
    this.input_ = new InputManager(this);
    const cx = GAME_WIDTH / 2;

    this.drawBackdrop();

    this.add.bitmapText(cx, 46, FONT_KEY, GAME_TITLE, 11).setOrigin(0.5).setScale(3).setTint(0xcfc2ff).setDepth(DEPTH.UI);
    this.add.bitmapText(cx, 74, FONT_KEY, 'Descend. Endure. Bargain.', 11).setOrigin(0.5).setTint(UI.textDim).setDepth(DEPTH.UI);

    const display = services.display;
    this.menu = new MenuList(this, this.input_, {
      x: cx,
      y: 122,
      spacing: 16,
      items: [
        {
          id: 'start',
          label: 'Enter the Abyss',
          onSelect: () => {
            this.menu.setEnabled(false);
            RunManager.startNewRun(this);
            SceneRouter.goTo(this, SceneKeys.LOADING, { floorId: 'test_chamber', floorNumber: 1, next: SceneKeys.DUNGEON });
          }
        },
        {
          id: 'scale',
          label: () => `Scaling: ${display.scaleMode === 'integer' ? 'Pixel Perfect' : 'Fit Screen'}`,
          onSelect: () => display.toggleScaleMode()
        },
        {
          id: 'fullscreen',
          label: () => `Fullscreen: ${display.isFullscreen ? 'On' : 'Off'}`,
          onSelect: () => display.toggleFullscreen()
        }
      ]
    });
    listen(this, Events.FULLSCREEN_CHANGED, () => this.menu.refresh());
    listen(this, Events.DISPLAY_CHANGED, () => this.menu.refresh());

    this.add
      .bitmapText(cx, GAME_HEIGHT - 26, FONT_KEY, 'WASD / Arrows - move     Enter - select     F11 - fullscreen', 11)
      .setOrigin(0.5)
      .setTint(UI.textDim)
      .setDepth(DEPTH.UI);
    this.add
      .bitmapText(GAME_WIDTH - 4, GAME_HEIGHT - 12, FONT_KEY, `v${GAME_VERSION} - ${BUILD_PHASE}`, 11)
      .setOrigin(1, 0)
      .setTint(0x5d566b)
      .setDepth(DEPTH.UI);
  }

  drawBackdrop() {
    const g = this.add.graphics();
    const bands = [0x07060b, 0x0a0810, 0x0d0a15, 0x110d1b, 0x140f20, 0x18112a];
    const bh = Math.ceil(GAME_HEIGHT / bands.length);
    bands.forEach((c, i) => g.fillStyle(c).fillRect(0, i * bh, GAME_WIDTH, bh));

    // Abyss rim: a dark arch silhouette at the bottom
    g.fillStyle(0x040307);
    for (let x = 0; x < GAME_WIDTH; x += 2) {
      const h = 18 + Math.round(Math.sin(x * 0.05) * 4 + Math.sin(x * 0.13) * 2);
      g.fillRect(x, GAME_HEIGHT - h, 2, h);
    }

    // Torches flanking the title
    for (const tx of [GAME_WIDTH / 2 - 150, GAME_WIDTH / 2 + 150]) {
      this.add.sprite(tx, 48, 'torch').setScale(2).play('torch_burn');
      const glow = this.add.image(tx, 50, 'light_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa040).setAlpha(0.5).setScale(1.6);
      this.tweens.add({ targets: glow, alpha: 0.7, duration: 220, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
    }

    // Rising embers from the abyss
    this.add.particles(0, GAME_HEIGHT, 'px_ember', {
      x: { min: 0, max: GAME_WIDTH },
      lifespan: { min: 3000, max: 6000 },
      speedY: { min: -14, max: -30 },
      speedX: { min: -4, max: 4 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xff7a1a, 0xffb347, 0x9a7cff],
      scale: { min: 0.5, max: 1 },
      frequency: 140,
      quantity: 1
    });
  }

  update() {
    this.input_.update();
  }
}
