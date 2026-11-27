import { TILE_SIZE } from '../core/constants.js';
import { computeFlowField, bestNeighbor, lineOfSight } from './FlowField.js';

const REFRESH_MS = 200;

/**
 * Runtime navigation for enemies on a DungeonMap's collision grid.
 * Keeps one flow field toward the player (recomputed only when the player
 * changes tile, at most every 200ms) shared by all enemies, so 50 chasers
 * cost the same as one.
 */
export class Navigation {
  constructor(dungeonMap) {
    this.grid = dungeonMap.grid;
    this.w = dungeonMap.map.width;
    this.h = dungeonMap.map.height;
    this.field = null;
    this.fieldTile = { tx: -1, ty: -1 };
    this.lastRefresh = -Infinity;
  }

  tileOf(x, y) {
    return { tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) };
  }

  center(tx, ty) {
    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  }

  isWalkableTile(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && this.grid[ty * this.w + tx] === 0;
  }

  isWalkable(x, y) {
    const { tx, ty } = this.tileOf(x, y);
    return this.isWalkableTile(tx, ty);
  }

  /** Call once per frame with the chase target's position. */
  setTarget(x, y, now) {
    const { tx, ty } = this.tileOf(x, y);
    if (!this.isWalkableTile(tx, ty)) return;
    if ((tx === this.fieldTile.tx && ty === this.fieldTile.ty) || now - this.lastRefresh < REFRESH_MS) return;
    this.field = computeFlowField(this.grid, this.w, this.h, tx, ty);
    this.fieldTile = { tx, ty };
    this.lastRefresh = now;
  }

  /** Path cost (in tiles) from a world point to the target; Infinity if unreachable. */
  pathDistance(x, y) {
    if (!this.field) return Infinity;
    const { tx, ty } = this.tileOf(x, y);
    const d = this.isWalkableTile(tx, ty) ? this.field[ty * this.w + tx] : -1;
    return d < 0 ? Infinity : d / 10;
  }

  hasLineOfSight(ax, ay, bx, by) {
    return lineOfSight(this.grid, this.w, this.h, ax / TILE_SIZE, ay / TILE_SIZE, bx / TILE_SIZE, by / TILE_SIZE);
  }

  /** LOS for a body of `radius` px: centre line plus two parallel edge lines. */
  hasClearPath(ax, ay, bx, by, radius = 5) {
    if (!this.hasLineOfSight(ax, ay, bx, by)) return false;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * radius;
    const ny = (dx / len) * radius;
    return this.hasLineOfSight(ax + nx, ay + ny, bx + nx, by + ny) && this.hasLineOfSight(ax - nx, ay - ny, bx - nx, by - ny);
  }

  /** Next tile centre toward (away=false) or away from (away=true) the target. */
  nextWaypoint(x, y, away = false) {
    if (!this.field) return null;
    let { tx, ty } = this.tileOf(x, y);
    if (!this.isWalkableTile(tx, ty)) return null;
    const n = bestNeighbor(this.field, this.grid, this.w, this.h, tx, ty, away);
    return n ? this.center(n.tx, n.ty) : null;
  }

  /** Random walkable point within `radiusTiles` of (x,y) that is directly reachable. */
  randomReachablePoint(x, y, radiusTiles, rng = Math.random, bodyRadius = 5) {
    const { tx, ty } = this.tileOf(x, y);
    for (let i = 0; i < 12; i++) {
      const nx = tx + Math.round((rng() * 2 - 1) * radiusTiles);
      const ny = ty + Math.round((rng() * 2 - 1) * radiusTiles);
      if (!this.isWalkableTile(nx, ny)) continue;
      const c = this.center(nx, ny);
      if (this.hasClearPath(x, y, c.x, c.y, bodyRadius)) return c;
    }
    return null;
  }
}
