import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { GAME_WIDTH, FONT_KEY, DEPTH } from '../core/constants.js';
import { SceneRouter } from '../core/SceneRouter.js';
import { EventBus } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { AssetManager } from '../managers/AssetManager.js';
import { InputManager } from '../managers/InputManager.js';
import { DungeonMap } from '../world/DungeonMap.js';
import { CameraController } from '../world/CameraController.js';
import { LightingLayer } from '../world/LightingLayer.js';
import { Player } from '../entities/Player.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';
import { UI } from '../ui/theme.js';

/**
 * A dungeon floor. Phase 1: tilemap, collision, lighting, player movement,
 * camera follow. Rooms, enemies and combat are added in Phases 2 and 4.
 *
 * data: { floorId, floorNumber }
 */
export class DungeonScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.DUNGEON);
  }

  init(data) {
    this.floorId = data.floorId ?? 'test_chamber';
    this.floorNumber = data.floorNumber ?? 1;
  }

  create() {
    SceneRouter.enter(this);
    const floor = AssetManager.getFloor(this, this.floorId);

    this.dungeon = new DungeonMap(this, floor.mapKey);
    this.physics.world.setBounds(0, 0, this.dungeon.widthInPixels, this.dungeon.heightInPixels);

    const character = AssetManager.getCharacter(this, 'wanderer');
    const spawn = this.dungeon.playerSpawn;
    this.player = new Player(this, spawn.x, spawn.y, character);
    this.physics.add.collider(this.player, this.dungeon.layers.walls);

    this.lighting = new LightingLayer(this, this.dungeon);
    this.lighting.attachLight(this.player, 44, 0x8fb0ff, 0.3);

    this.cameraController = new CameraController(this, {
      bounds: { width: this.dungeon.widthInPixels, height: this.dungeon.heightInPixels },
      target: this.player
    });

    this.input_ = new InputManager(this);
    this.debug = new DebugOverlay(this, { player: this.player, map: this.dungeon, input: this.input_ });
    this.input_.on('pressed', (action) => {
      if (action === 'debug') this.debug.toggle();
      // Temporary until the Pause Menu exists (Phase 3 UI): ESC returns to the main menu.
      if (action === 'pause') SceneRouter.goTo(this, SceneKeys.MAIN_MENU);
    });

    this.showFloorBanner(floor.name);
    this.events.once('shutdown', () => {
      this.dungeon.destroy();
      this.dungeon = null;
    });
    EventBus.emit(Events.FLOOR_LOADED, { floorId: this.floorId, floorNumber: this.floorNumber, validation: this.dungeon.validation });
  }

  showFloorBanner(name) {
    const banner = this.add
      .bitmapText(GAME_WIDTH / 2, 20, FONT_KEY, `Floor ${this.floorNumber} - ${name}`, 11)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI)
      .setTint(UI.accent)
      .setAlpha(0);
    this.tweens.chain({
      targets: banner,
      tweens: [
        { alpha: 1, duration: 400, delay: 200 },
        { alpha: 0, duration: 600, delay: 2200 }
      ],
      onComplete: () => banner.destroy()
    });
  }

  update(time, delta) {
    this.input_.update();
    this.player.updateControl(this.input_, Math.min(delta, 50) / 1000);
    this.debug.update();
  }
}
