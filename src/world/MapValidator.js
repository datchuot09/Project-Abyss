// Pure map-safety checks (no Phaser) – used at runtime and in unit tests.
// Guarantees from the design doc: no spawning inside colliders and no
// unreachable/unplayable terrain around spawn points.

/** grid: Uint8Array|number[] of width*height, 1 = solid, 0 = walkable */
export function isWalkable(grid, width, height, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;
  return grid[ty * width + tx] === 0;
}

/** Breadth-first search for the closest walkable tile (Manhattan rings). */
export function findNearestWalkable(grid, width, height, tx, ty, maxRadius = 16) {
  if (isWalkable(grid, width, height, tx, ty)) return { tx, ty };
  const seen = new Set([ty * width + tx]);
  let frontier = [[tx, ty]];
  for (let r = 0; r < maxRadius && frontier.length; r++) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const id = ny * width + nx;
        if (seen.has(id)) continue;
        seen.add(id);
        if (grid[id] === 0) return { tx: nx, ty: ny };
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return null;
}

/** 4-connected flood fill from a tile; returns a Uint8Array reachability mask. */
export function floodFill(grid, width, height, sx, sy) {
  const reach = new Uint8Array(width * height);
  if (!isWalkable(grid, width, height, sx, sy)) return reach;
  const stack = [sy * width + sx];
  reach[stack[0]] = 1;
  while (stack.length) {
    const id = stack.pop();
    const x = id % width;
    const y = (id - x) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nid = ny * width + nx;
      if (reach[nid] || grid[nid] !== 0) continue;
      reach[nid] = 1;
      stack.push(nid);
    }
  }
  return reach;
}

/**
 * @param {{grid, width, height, spawns: {name:string, tx:number, ty:number}[]}} map
 *   The first spawn named "player_spawn" is the reachability origin.
 */
export function validateMap({ grid, width, height, spawns }) {
  const errors = [];
  const warnings = [];
  for (const s of spawns) {
    if (!isWalkable(grid, width, height, s.tx, s.ty)) errors.push(`${s.name} at tile (${s.tx},${s.ty}) is inside a collider or out of bounds`);
  }
  const player = spawns.find((s) => s.name === 'player_spawn');
  let walkable = 0;
  let reachable = 0;
  if (!player) {
    errors.push('map has no player_spawn');
  } else if (isWalkable(grid, width, height, player.tx, player.ty)) {
    const reach = floodFill(grid, width, height, player.tx, player.ty);
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === 0) walkable++;
      if (reach[i]) reachable++;
    }
    for (const s of spawns) {
      if (s !== player && isWalkable(grid, width, height, s.tx, s.ty) && !reach[s.ty * width + s.tx]) {
        warnings.push(`${s.name} at tile (${s.tx},${s.ty}) is not reachable from player_spawn`);
      }
    }
    if (reachable < walkable) warnings.push(`${walkable - reachable} walkable tiles are unreachable from player_spawn`);
  }
  return { ok: errors.length === 0, errors, warnings, walkable, reachable };
}
