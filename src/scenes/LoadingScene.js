import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_KEY } from '../core/constants.js';
import { SceneRouter } from '../core/SceneRouter.js';
import { AssetManager } from '../managers/AssetManager.js';
import { InputManager } from '../managers/InputManager.js';
import { UI } from '../ui/theme.js';

const MIN_DISPLAY_MS = 900;

/**
 * Floor transition screen (design doc 8.4): next floor name + description,
 * spinner and progress bar at the bottom-right. Finishes only when the floor
 * assets are actually in the cache.
 *
 * data: { floorId, floorNumber, next: SceneKey }
 */
export class LoadingScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.LOADING);
  }

  init(data) {
    this.floorId = data.floorId;
    this.floorNumber = data.floorNumber ?? 1;
    this.nextScene = data.next ?? SceneKeys.DUNGEON;
    this.failed = [];
    this.ready = false;
    this.minTimeDone = false;
  }

  create() {
    SceneRouter.enter(this, { fadeMs: 200 });
    this.input_ = new InputManager(this);
    const floor = AssetManager.getFloor(this, this.floorId);
    const cx = GAME_WIDTH / 2;

    this.add.bitmapText(cx, 92, FONT_KEY, `FLOOR ${this.floorNumber}`, 11).setOrigin(0.5).setScale(2).setTint(UI.accent);
    this.add.bitmapText(cx, 118, FONT_KEY, floor.name, 11).setOrigin(0.5).setTint(UI.text);
    this.add.bitmapText(cx, 138, FONT_KEY, floor.description ?? '', 11).setOrigin(0.5, 0).setMaxWidth(320).setCenterAlign().setTint(UI.textDim);

    // Bottom-right indicator: rotating rune + progress bar
    const bx = GAME_WIDTH - 96;
    const by = GAME_HEIGHT - 16;
    this.spinner = this.add.graphics({ x: GAME_WIDTH - 14, y: by + 1 });
    this.spinner.lineStyle(1, UI.arcane).strokeRect(-4, -4, 8, 8).fillStyle(UI.accentHot).fillRect(-1, -1, 2, 2);
    this.add.bitmapText(bx, by - 13, FONT_KEY, 'Loading...', 11).setTint(UI.textDim);
    this.add.rectangle(bx, by, 72, 4, 0x1b1724).setOrigin(0, 0.5);
    this.bar = this.add.rectangle(bx, by, 0, 4, UI.accent).setOrigin(0, 0.5);

    this.time.delayedCall(MIN_DISPLAY_MS, () => {
      this.minTimeDone = true;
      this.tryFinish();
    });

    this.load.on('progress', (v) => this.bar.setSize(Math.round(72 * v), 4));
    this.load.on('loaderror', (file) => {
      this.failed.push(file.key);
      console.error('[Loading] Failed to load', file.key, file.url);
    });
    this.load.once('complete', () => this.onLoaded());

    const queued = AssetManager.queueFloor(this, this.floorId);
    if (queued > 0) this.load.start();
    else this.onLoaded();
  }

  onLoaded() {
    if (this.failed.length || !AssetManager.isFloorReady(this, this.floorId)) {
      this.add
        .bitmapText(GAME_WIDTH / 2, 190, FONT_KEY, `Failed to load: ${this.failed.join(', ')}\nPress Enter to return.`, 11)
        .setOrigin(0.5, 0)
        .setCenterAlign()
        .setTint(UI.danger);
      this.input_.on('pressed', (a) => a === 'confirm' && SceneRouter.goTo(this, SceneKeys.MAIN_MENU));
      return;
    }
    this.bar.setSize(72, 4);
    this.ready = true;
    this.tryFinish();
  }

  tryFinish() {
    if (!this.ready || !this.minTimeDone) return;
    SceneRouter.goTo(this, this.nextScene, { floorId: this.floorId, floorNumber: this.floorNumber });
  }

  update(time) {
    this.input_.update();
    this.spinner.rotation = Math.floor(time / 120) * (Math.PI / 4); // stepped = pixel-art feel
  }
}
