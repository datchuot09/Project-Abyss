import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/constants.js';
import { AssetManager } from '../managers/AssetManager.js';

/** Loads the "core" asset group (shared by every scene) with a progress bar. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.PRELOAD);
  }

  preload() {
    this.failed = [];
    const w = 160;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT / 2;
    this.add.rectangle(x - 2, y - 2, w + 4, 8, 0x3b3349).setOrigin(0);
    this.add.rectangle(x - 1, y - 1, w + 2, 6, 0x0a0810).setOrigin(0);
    const bar = this.add.rectangle(x, y, 0, 4, 0xd9b25f).setOrigin(0);
    this.load.on('progress', (v) => bar.setSize(Math.round(w * v), 4));
    this.load.on('loaderror', (file) => {
      this.failed.push(file.key);
      console.error('[Preload] Failed to load', file.key, file.url);
    });
    AssetManager.queueGroup(this, 'core');
  }

  create() {
    if (this.failed.length) {
      this.add.text(8, 8, `Missing assets:\n${this.failed.join('\n')}`, { color: '#ff6070', fontSize: '10px' });
      return;
    }
    const manifest = AssetManager.getManifest(this);
    for (const id of Object.keys(manifest.characters ?? {})) {
      AssetManager.createCharacterAnimations(this, AssetManager.getCharacter(this, id));
    }
    for (const id of Object.keys(manifest.monsters ?? {})) {
      AssetManager.createCharacterAnimations(this, AssetManager.getMonster(this, id));
    }
    AssetManager.createSharedAnimations(this);
    this.scene.start(SceneKeys.MAIN_MENU);
  }
}
