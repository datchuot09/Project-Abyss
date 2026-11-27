// Global, engine-independent constants. Pure module (safe to import in Node tests).
export const GAME_TITLE = 'PROJECT ABYSS';
export const GAME_VERSION = '0.3.0';
export const BUILD_PHASE = 'Phase 3 - HUD & Progression';

// Logical resolution (16:9). Everything is authored at this size and scaled up.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const TILE_SIZE = 16;

// Render ordering. Entities are y-sorted on top of DEPTH.ENTITIES.
export const DEPTH = Object.freeze({
  FLOOR: 0,
  DECOR: 1,
  WALLS: 2,
  WALL_DECOR: 3,
  ENTITIES: 100,
  AMBIENT: 8000,
  LIGHTS: 8500,
  UI: 10000,
  DEBUG: 20000
});

export const FONT_KEY = 'abyss_font';
export const FONT_SIZE = 11; // BitmapText line size of abyss_font at scale 1
