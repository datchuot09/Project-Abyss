import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_KEY, DEPTH } from '../core/constants.js';
import { SceneRouter } from '../core/SceneRouter.js';
import { EventBus, listen } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { AssetManager } from '../managers/AssetManager.js';
import { InputManager } from '../managers/InputManager.js';
import { RunManager } from '../managers/RunManager.js';
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
 * A dungeon floor: tilemap, lighting, player, enemies and combat, run
 * progression (EXP / level-up / stamina) and the death sequence.
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
    this.levelUpRequested = false;
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
    this.run = RunManager.ensureRun(this);
    this.run.floor = this.floorNumber;

    // Player
    const character = AssetManager.getCharacter(this, 'wanderer');
    const spawn = this.dungeon.playerSpawn;
    this.player = new Player(this, spawn.x, spawn.y, character, ctx);
    this.physics.add.collider(this.player, this.dungeon.layers.walls);
    this.player.recomputeStats(this.run, RunManager.buffDefs(this));
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
    this.input_ = new InputManager(this);
    this.hud = new HUD(this, this.player, this.run, { keyLabel: (a) => this.keyLabel(a) });
    this.crosshair = this.add.image(0, 0, 'crosshair').setScrollFactor(0).setDepth(DEPTH.UI + 5).setVisible(false);
    this.input.setDefaultCursor('none');

    // Input
    this.debug = new DebugOverlay(this, { player: this.player, map: this.dungeon, input: this.input_ });
    this.input_.on('pressed', (action) => {
      if (action === 'debug') this.debug.toggle();
      if (action === 'pause' && !this.defeated) this.openPause();
    });

    listen(this, Events.ENTITY_DIED, this.onEntityDied, this);
    listen(this, Events.PLAYER_DIED, this.onPlayerDied, this);
    listen(this, Events.COMBAT_HIT, this.onCombatHit, this);
    listen(this, Events.RUN_LEVEL_UP, () => (this.levelUpRequested = true), this);
    listen(this, Events.RUN_BUFFS_CHANGED, this.onBuffChosen, this);
    listen(this, Events.STAMINA_CHANGED, () => this.player.recomputeStats(this.run, RunManager.buffDefs(this)), this);
    this.events.on('resume', this.onResume, this);

    this.showBanner(`Floor ${this.floorNumber} - ${floor.name}`, UI.accent);
    this.events.once('shutdown', () => {
      this.events.off('resume', this.onResume, this);
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

  keyLabel(action) {
    const name = this.input_.getKeyBindings()[action]?.[0] ?? '?';
    return { MOUSE_LEFT: 'LMB', MOUSE_RIGHT: 'RMB', MOUSE_MIDDLE: 'MMB', SPACE: 'SPC' }[name] ?? name;
  }

  onEntityDied({ entity }) {
    if (entity.team !== 'enemy') return;
    this.run.kills++;
    const exp = entity.def.exp ?? 0;
    if (exp > 0) {
      this.effects.number(entity.x, entity.y - 18, `+${exp} EXP`, 0xd9b25f);
      RunManager.grantExp(exp, entity.id);
    }
    if (this.aliveEnemies.length === 0) {
      EventBus.emit(Events.ENEMIES_CLEARED, { floorId: this.floorId });
      this.showBanner('The chamber falls silent', UI.accentHot);
    }
  }

  onCombatHit({ team, damage }) {
    if (team === 'enemy') this.run.damageDealt += damage;
    else if (team === 'player') this.run.damageTaken += damage;
  }

  onBuffChosen({ chosen }) {
    this.player.recomputeStats(this.run, RunManager.buffDefs(this));
    if (chosen?.instantHeal) this.player.heal(this.player.health.max * chosen.instantHeal, 'buff');
    this.pendingLevelFx = true;
  }

  openLevelUp() {
    this.levelUpRequested = false;
    if (this.defeated || this.player.isDead || this.run.pendingLevelUps <= 0) return;
    this.scene.pause();
    this.scene.launch(SceneKeys.LEVEL_UP, { returnTo: this.scene.key });
  }

  openPause() {
    this.scene.pause();
    this.scene.launch(SceneKeys.PAUSE, { returnTo: this.scene.key });
  }

  onResume() {
    this.input.setDefaultCursor('none');
    this.input_.setEnabled(true);
    if (this.pendingLevelFx) {
      this.pendingLevelFx = false;
      this.effects.levelUp(this.player);
    }
  }

  /** Death sequence (design doc 5.4): fall -> killer's finisher + blood -> Game Over. */
  onPlayerDied({ killer }) {
    if (this.defeated) return;
    this.defeated = true;
    RunManager.endRun();
    const p = this.player;
    this.effects.blood(p.x, p.y - 4, 1);
    let finished = false;
    const toGameOver = () => {
      if (finished) return;
      finished = true;
      this.time.delayedCall(500, () => {
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start(SceneKeys.GAME_OVER, { summary: this.run.toJSON(), cause: killer?.def?.name ?? 'the abyss' });
        });
        this.cameras.main.fadeOut(900, 30, 0, 6);
      });
    };
    if (killer && killer.startFinisher && killer.distanceTo(p) < 260 && killer.startFinisher(p)) {
      listen(this, Events.FINISHER_DONE, toGameOver, this);
      this.time.delayedCall(5000, toGameOver); // safety net
    } else {
      this.time.delayedCall(900, toGameOver);
    }
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
    this.effects.updateStatusVisuals(this.combat.combatants, dt);

    const pointer = this.input.activePointer;
    this.crosshair.setVisible(this.input_.aimDevice === 'mouse' && !this.defeated);
    this.crosshair.setPosition(Math.round(pointer.x), Math.round(pointer.y));

    this.hud.update(dt);
    this.debug.update();
    if (this.levelUpRequested) this.openLevelUp();
  }
}
