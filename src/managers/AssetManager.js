// Manifest-driven asset loading (public/data/asset-manifest.json).
//
// - Assets are declared as data, never hard-coded in scenes.
// - Anything already in Phaser's caches is skipped, so moving between rooms
//   or floors never reloads shared resources.
// - Floor-specific assets can be released when a floor is left (memory).
export const MANIFEST_KEY = 'asset-manifest';
export const MANIFEST_URL = 'data/asset-manifest.json';

const LOADERS = {
  image: (load, a) => load.image(a.key, a.url),
  spritesheet: (load, a) => load.spritesheet(a.key, a.url, a.frameConfig),
  bitmapFont: (load, a) => load.bitmapFont(a.key, a.textureURL, a.fontDataURL),
  json: (load, a) => load.json(a.key, a.url),
  tilemapTiledJSON: (load, a) => load.tilemapTiledJSON(a.key, a.url),
  audio: (load, a) => load.audio(a.key, a.urls ?? a.url)
};

function isCached(scene, a) {
  switch (a.type) {
    case 'image':
    case 'spritesheet':
      return scene.textures.exists(a.key);
    case 'bitmapFont':
      return scene.cache.bitmapFont.exists(a.key);
    case 'json':
      return scene.cache.json.exists(a.key);
    case 'tilemapTiledJSON':
      return scene.cache.tilemap.exists(a.key);
    case 'audio':
      return scene.cache.audio.exists(a.key);
    default:
      return false;
  }
}

export const AssetManager = {
  getManifest(scene) {
    const manifest = scene.cache.json.get(MANIFEST_KEY);
    if (!manifest) throw new Error('[Assets] Manifest not loaded – BootScene must run first.');
    return manifest;
  },

  /** Queue a list of asset descriptors on the scene loader. Returns the number queued. */
  queue(scene, assets) {
    let queued = 0;
    for (const a of assets) {
      const loader = LOADERS[a.type];
      if (!loader) {
        console.warn(`[Assets] Unsupported asset type "${a.type}" (${a.key}).`);
        continue;
      }
      if (isCached(scene, a)) continue;
      loader(scene.load, a);
      queued++;
    }
    return queued;
  },

  queueGroup(scene, group) {
    const assets = this.getManifest(scene).groups?.[group];
    if (!assets) throw new Error(`[Assets] Unknown asset group "${group}".`);
    return this.queue(scene, assets);
  },

  getFloor(scene, floorId) {
    const floor = this.getManifest(scene).floors?.[floorId];
    if (!floor) throw new Error(`[Assets] Unknown floor "${floorId}".`);
    return floor;
  },

  queueFloor(scene, floorId) {
    return this.queue(scene, this.getFloor(scene, floorId).assets ?? []);
  },

  isFloorReady(scene, floorId) {
    return (this.getFloor(scene, floorId).assets ?? []).every((a) => isCached(scene, a));
  },

  /** Drop cached data that only one floor used (call after leaving that floor). */
  releaseFloor(scene, floorId) {
    for (const a of this.getFloor(scene, floorId).assets ?? []) {
      if (a.type === 'tilemapTiledJSON') scene.cache.tilemap.remove(a.key);
      else if (a.type === 'json') scene.cache.json.remove(a.key);
      else if ((a.type === 'image' || a.type === 'spritesheet') && scene.textures.exists(a.key)) scene.textures.remove(a.key);
    }
  },

  /** Character definitions (public/data/characters/*.json) listed in the manifest. */
  getCharacter(scene, id) {
    const key = this.getManifest(scene).characters?.[id];
    const data = key && scene.cache.json.get(key);
    if (!data) throw new Error(`[Assets] Character "${id}" is not loaded.`);
    return data;
  },

  /** Build Phaser animations for a character from its data file. Idempotent. */
  createCharacterAnimations(scene, character) {
    const { texture, columns } = character.sprite;
    for (const [state, def] of Object.entries(character.animations ?? {})) {
      for (const [dir, row] of Object.entries(def.rows)) {
        const key = `${character.id}_${state}_${dir}`;
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(texture, { frames: def.frames.map((f) => row * columns + f) }),
          frameRate: def.frameRate,
          repeat: def.repeat ?? -1
        });
      }
    }
  },

  /** Generic (non-character) animations declared in the manifest. */
  createSharedAnimations(scene) {
    for (const [key, def] of Object.entries(this.getManifest(scene).animations ?? {})) {
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(def.texture, { frames: def.frames }),
        frameRate: def.frameRate,
        repeat: def.repeat ?? -1
      });
    }
  },

};
