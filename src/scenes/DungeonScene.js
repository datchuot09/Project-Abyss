import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_KEY, DEPTH } from '../core/constants.js';
import { SceneRouter } from '../core/SceneRouter.js';
import { EventBus, listen } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { AssetManager } from '../managers/AssetManager.js';
import { InputManager } from '../managers/InputManager.js';
import { DungeonMap } from '../world/DungeonMap.js';
import { Navigation } from '../world/Navigation.js';
import { CameraController } from '../world/CameraController.js';
import { LightingLayer } from '../world/LightingLayer.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { EffectsSystem } from '../systems/EffectsSystem.js';
import { Player } from '../entities/Player.js';
import { createEnemy } from '../entities/EnemyFactory.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';
import { HUD } from '../ui/HUD.js';
import { UI } from '../ui/theme.js';

/**
 * A dungeon floor: tilemap, lighting, player, enemies and combat.
 * Room flow (clear conditions, doors, chests) arrives in Phase 4.
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
    this.defeated = false;
  }

  create() {
    SceneRouter.enter(this);
    const floor = AssetManager.getFloor(this, this.floorId);

    // World
    this.dungeon = new DungeonMap(this, floor.mapKey);
    this.physics.world.setBounds(0, 0, this.dungeon.widthInPixels, this.dungeon.heightInPixels);
    this.navigation = new Navigation(this.dungeon);

    // Systems
    this.combat = new CombatSystem(this);
    this.effects = new EffectsSystem(this);
    this.projectiles = new ProjectileSystem(this, {
      combat: this.combat,
      wallsLayer: this.dungeon.layers.walls,
      effects: this.effects,
      defs: AssetManager.getProjectiles(this)
    });
    const ctx = { combat: this.combat, projectiles: this.projectiles, effects: this.effects, nav: this.navigation, target: null };

    // Player
    const character = AssetManager.getCharacter(this, 'wanderer');
    const spawn = this.dungeon.playerSpawn;
    this.player = new Player(this, spawn.x, spawn.y, character, ctx);
    this.physics.add.collider(this.player, this.dungeon.layers.walls);
    ctx.target = this.player;

    // Enemies
    this.enemies = this.add.group();
    for (const obj of this.dungeon.getObjects('Spawns', 'enemy_spawn')) {
      const type = obj.props.monster;
      if (!type) continue;
      const pos = this.dungeon.resolveSpawn(obj);
      this.enemies.add(createEnemy(this, AssetManager.getMonster(this, type), pos.x, pos.y, ctx));
    }
    this.physics.add.collider(this.enemies, this.dungeon.layers.walls);
    this.physics.add.collider(this.enemies, this.enemies);
    this.enemiesSpawned = this.enemies.getLength();

    // Presentation
    this.lighting = new LightingLayer(this, this.dungeon);
    this.lighting.attachLight(this.player, 44, 0x8fb0ff, 0.3);
    this.cameraController = new CameraController(this, {
      bounds: { width: this.dungeon.widthInPixels, height: this.dungeon.heightInPixels },
      target: this.player
    });
    this.hud = new HUD(this, this.player);
    this.crosshair = this.add.image(0, 0, 'crosshair').setScrollFactor(0).setDepth(DEPTH.UI + 5).setVisible(false);
    this.input.setDefaultCursor('none');

    // Input
    this.input_ = new InputManager(this);
    this.debug = new DebugOverlay(this, { player: this.player, map: this.dungeon, input: this.input_ });
    this.input_.on('pressed', (action) => {
      if (action === 'debug') this.debug.toggle();
      if (this.defeated) {
        if (action === 'confirm') this.scene.restart({ floorId: this.floorId, floorNumber: this.floorNumber });
        if (action === 'pause' || action === 'back') SceneRouter.goTo(this, SceneKeys.MAIN_MENU);
        return;
      }
      // Temporary until the Pause Menu exists (Phase 3 UI): ESC returns to the main menu.
      if (action === 'pause') SceneRouter.goTo(this, SceneKeys.MAIN_MENU);
    });

    listen(this, Events.ENTITY_DIED, this.onEntityDied, this);
    listen(this, Events.PLAYER_DIED, this.onPlayerDied, this);

    this.showBanner(`Floor ${this.floorNumber} - ${floor.name}`, UI.accent);
    this.events.once('shutdown', () => {
      this.input.setDefaultCursor('default');
      this.combat.destroy();
      this.dungeon.destroy();
      this.dungeon = null;
    });
    EventBus.emit(Events.FLOOR_LOADED, { floorId: this.floorId, floorNumber: this.floorNumber, validation: this.dungeon.validation });
  }

  get aliveEnemies() {
    return this.enemies.getChildren().filter((e) => e.isTargetable());
  }

  onEntityDied({ entity }) {
    if (entity.team !== 'enemy') return;
    if (this.aliveEnemies.length === 0) {
      EventBus.emit(Events.ENEMIES_CLEARED, { floorId: this.floorId });
      this.showBanner('The chamber falls silent', UI.accentHot);
    }
  }

  onPlayerDied() {
    this.defeated = true;
    this.time.delayedCall(500, () => {
      const veil = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050307, 1).setOrigin(0).setScrollFactor(0)
        .setDepth(DEPTH.UI + 10).setAlpha(0);
      const title = this.add.bitmapText(GAME_WIDTH / 2, 110, FONT_KEY, 'YOU HAVE FALLEN', 11).setOrigin(0.5).setScale(2)
        .setTint(UI.danger).setScrollFactor(0).setDepth(DEPTH.UI + 11).setAlpha(0);
      const hint = this.add.bitmapText(GAME_WIDTH / 2, 140, FONT_KEY, 'Enter - Rise again      Esc - Main menu', 11).setOrigin(0.5)
        .setTint(UI.textDim).setScrollFactor(0).setDepth(DEPTH.UI + 11).setAlpha(0);
      this.tweens.add({ targets: veil, alpha: 0.75, duration: 700 });
      this.tweens.add({ targets: [title, hint], alpha: 1, duration: 500, delay: 400 });
    });
  }

  showBanner(text, tint) {
    this.banner?.destroy();
    const banner = this.add
      .bitmapText(GAME_WIDTH / 2, 34, FONT_KEY, text, 11)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI)
      .setTint(tint)
      .setAlpha(0);
    this.banner = banner;
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
    const dt = Math.min(delta, 50) / 1000;
    this.input_.update();
    const pc = this.player.body.center;
    this.navigation.setTarget(pc.x, pc.y, time);

    this.player.updateControl(this.input_, dt);
    for (const enemy of this.enemies.getChildren()) enemy.think(dt);
    this.combat.update(dt);
    this.projectiles.update(dt);

    const pointer = this.input.activePointer;
    this.crosshair.setVisible(this.input_.lastDevice === 'mouse' && !this.defeated);
    this.crosshair.setPosition(Math.round(pointer.x), Math.round(pointer.y));

    this.hud.update(dt);
    this.debug.update();
  }
}
