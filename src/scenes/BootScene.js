import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { MANIFEST_KEY, MANIFEST_URL } from '../managers/AssetManager.js';

/** Loads only the asset manifest, then hands off to PreloadScene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.BOOT);
  }

  preload() {
    this.load.json(MANIFEST_KEY, MANIFEST_URL);
    this.load.once('loaderror', (file) => console.error('[Boot] Failed to load', file.key, file.url));
  }

  create() {
    if (!this.cache.json.exists(MANIFEST_KEY)) {
      this.add.text(8, 8, 'Failed to load asset manifest.\nCheck the console.', { color: '#ff6070', fontSize: '10px' });
      return;
    }
    this.scene.start(SceneKeys.PRELOAD);
  }
}
