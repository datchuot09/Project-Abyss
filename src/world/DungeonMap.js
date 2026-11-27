import { DEPTH, TILE_SIZE } from '../core/constants.js';
import { parseTiledColor } from '../core/math.js';
import { findNearestWalkable, validateMap } from './MapValidator.js';

const TILESET_NAME = 'dungeon_tiles';
const TILESET_TEXTURE = 'dungeon_tiles';

/**
 * Wraps a Tiled map: builds layers, collision, reads spawn/light objects and
 * validates that every spawn point is on walkable, reachable ground.
 *
 * Expected Tiled layers: Floor, Decor, Walls (tiles with bool property
 * "collides"), Spawns (objects), Lights (objects).
 */
export class DungeonMap {
  constructor(scene, mapKey) {
    this.scene = scene;
    this.map = scene.make.tilemap({ key: mapKey });
    this.tileset = this.map.addTilesetImage(TILESET_NAME, TILESET_TEXTURE);
    if (!this.tileset) throw new Error(`[DungeonMap] Tileset "${TILESET_NAME}" missing in ${mapKey}`);

    this.layers = {
      floor: this.createLayer('Floor', DEPTH.FLOOR),
      decor: this.createLayer('Decor', DEPTH.DECOR),
      walls: this.createLayer('Walls', DEPTH.WALLS)
    };
    if (!this.layers.walls) throw new Error(`[DungeonMap] ${mapKey} has no "Walls" layer`);
    this.layers.walls.setCollisionByProperty({ collides: true });

    this.properties = Object.fromEntries((this.map.properties ?? []).map((p) => [p.name, p.value]));
    this.widthInPixels = this.map.widthInPixels;
    this.heightInPixels = this.map.heightInPixels;

    this.grid = this.buildCollisionGrid();
    this.validation = this.validate();
    this.playerSpawn = this.resolveSpawn(this.getObjects('Spawns', 'player_spawn')[0]);
  }

  createLayer(name, depth) {
    if (this.map.getLayerIndex(name) === null) return null;
    const layer = this.map.createLayer(name, this.tileset, 0, 0);
    layer.setDepth(depth);
    return layer;
  }

  buildCollisionGrid() {
    const { width, height } = this.map;
    const grid = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const wall = this.layers.walls.getTileAt(x, y);
        const floor = this.layers.floor?.getTileAt(x, y);
        // Solid if a colliding wall is there, or there is no floor at all.
        grid[y * width + x] = (wall && wall.collides) || !floor ? 1 : 0;
      }
    }
    return grid;
  }

  getObjects(layerName, type) {
    const layer = this.map.getObjectLayer(layerName);
    if (!layer) return [];
    return layer.objects
      .filter((o) => !type || o.type === type || o.name === type)
      .map((o) => ({
        ...o,
        props: Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]))
      }));
  }

  worldToTile(x, y) {
    return { tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) };
  }

  tileCenter(tx, ty) {
    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  }

  isWalkableWorld(x, y) {
    const { tx, ty } = this.worldToTile(x, y);
    return tx >= 0 && ty >= 0 && tx < this.map.width && ty < this.map.height && this.grid[ty * this.map.width + tx] === 0;
  }

  /** Returns a guaranteed-walkable world position for a spawn object. */
  resolveSpawn(obj) {
    const fallback = { x: this.widthInPixels / 2, y: this.heightInPixels / 2 };
    const src = obj ?? fallback;
    const { tx, ty } = this.worldToTile(src.x, src.y);
    const safe = findNearestWalkable(this.grid, this.map.width, this.map.height, tx, ty, 32);
    if (!safe) throw new Error('[DungeonMap] No walkable tile found for spawn');
    if (safe.tx !== tx || safe.ty !== ty || !obj) {
      console.warn(`[DungeonMap] Spawn moved from tile (${tx},${ty}) to (${safe.tx},${safe.ty}) – it was blocked.`);
      return this.tileCenter(safe.tx, safe.ty);
    }
    return { x: src.x, y: src.y };
  }

  validate() {
    const spawns = this.getObjects('Spawns').map((o) => ({ name: o.type || o.name, ...this.worldToTile(o.x, o.y) }));
    const result = validateMap({ grid: this.grid, width: this.map.width, height: this.map.height, spawns });
    result.errors.forEach((e) => console.error('[DungeonMap]', e));
    result.warnings.forEach((w) => console.warn('[DungeonMap]', w));
    return result;
  }

  get ambientColor() {
    return parseTiledColor(this.properties.ambientColor, 0xa0a0c8);
  }

  destroy() {
    this.map?.destroy();
    this.map = null;
  }
}
