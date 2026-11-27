import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GAME_TITLE, GAME_VERSION } from './core/constants.js';
import { services } from './core/services.js';
import { EventBus } from './core/EventBus.js';
import { Events } from './core/Events.js';
import { SettingsManager } from './managers/SettingsManager.js';
import { DisplayManager } from './managers/DisplayManager.js';
import { SCENES } from './scenes/index.js';
import { createEnemy } from './entities/EnemyFactory.js';

services.settings = new SettingsManager(undefined, (path, value) => EventBus.emit(Events.SETTINGS_CHANGED, path, value));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  title: GAME_TITLE,
  version: GAME_VERSION,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  disableContextMenu: true,
  banner: false,
  fps: { target: 60 },
  scale: {
    // Sizing is owned by DisplayManager (integer zoom + letterbox).
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    zoom: 1
  },
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    gamepad: true,
    activePointers: 3
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false, fixedStep: true, fps: 60 }
  },
  scene: SCENES
});

services.display = new DisplayManager(game, services.settings);
game.events.once(Phaser.Core.Events.READY, () => services.display.init());

// Debug/test handle: available in dev builds, or in production with ?debug.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  window.__ABYSS__ = { game, services, EventBus, debugFactory: { createEnemy } };
}
