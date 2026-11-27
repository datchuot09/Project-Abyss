// Pure grid navigation helpers (unit tested): Dijkstra flow fields with
// 8-way movement (no corner cutting) and grid line-of-sight.
const ORTHO = 10;
const DIAG = 14;
const DIRS = [
  [1, 0, ORTHO], [-1, 0, ORTHO], [0, 1, ORTHO], [0, -1, ORTHO],
  [1, 1, DIAG], [1, -1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG]
];

function walkable(grid, w, h, x, y) {
  return x >= 0 && y >= 0 && x < w && y < h && grid[y * w + x] === 0;
}

/** A diagonal step is only legal if both orthogonal neighbours are open. */
export function canStep(grid, w, h, x, y, dx, dy) {
  if (!walkable(grid, w, h, x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0) return walkable(grid, w, h, x + dx, y) && walkable(grid, w, h, x, y + dy);
  return true;
}

/** Distance field (cost units, ortho = 10) to the target tile; -1 = unreachable. */
export function computeFlowField(grid, w, h, tx, ty, maxCost = Infinity) {
  const dist = new Int32Array(w * h).fill(-1);
  if (!walkable(grid, w, h, tx, ty)) return dist;
  // Binary heap of [cost, index]
  const heap = [[0, ty * w + tx]];
  dist[ty * w + tx] = 0;
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [cost, id] = pop();
    if (cost > dist[id]) continue;
    const x = id % w;
    const y = (id - x) / w;
    for (const [dx, dy, c] of DIRS) {
      if (!canStep(grid, w, h, x, y, dx, dy)) continue;
      const nc = cost + c;
      if (nc > maxCost) continue;
      const nid = (y + dy) * w + (x + dx);
      if (dist[nid] === -1 || nc < dist[nid]) {
        dist[nid] = nc;
        push([nc, nid]);
      }
    }
  }
  return dist;
}

/**
 * Neighbour tile that goes down (toward target) or up (away) the field.
 * Returns null if no improving step exists.
 */
export function bestNeighbor(field, grid, w, h, x, y, away = false) {
  const here = field[y * w + x];
  let best = null;
  let bestCost = here;
  for (const [dx, dy] of DIRS) {
    if (!canStep(grid, w, h, x, y, dx, dy)) continue;
    const c = field[(y + dy) * w + (x + dx)];
    if (c < 0) continue;
    if (here < 0 || (away ? c > bestCost : c < bestCost)) {
      bestCost = c;
      best = { tx: x + dx, ty: y + dy };
      if (here < 0) break;
    }
  }
  return best;
}

/**
 * Line of sight in tile space (floats, 1 unit = 1 tile) using a supercover
 * grid traversal: every tile the segment touches must be walkable.
 */
export function lineOfSight(grid, w, h, x0, y0, x1, y1) {
  let tx = Math.floor(x0);
  let ty = Math.floor(y0);
  const ex = Math.floor(x1);
  const ey = Math.floor(y1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? tx + 1 - x0 : x0 - tx) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? ty + 1 - y0 : y0 - ty) * tDeltaY : Infinity;
  if (!walkable(grid, w, h, tx, ty)) return false;
  let guard = w + h + 4;
  while ((tx !== ex || ty !== ey) && guard-- > 0) {
    if (Math.abs(tMaxX - tMaxY) < 1e-9) {
      // passing exactly through a corner: both neighbours must be open
      if (!walkable(grid, w, h, tx + stepX, ty) || !walkable(grid, w, h, tx, ty + stepY)) return false;
      tx += stepX;
      ty += stepY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      tx += stepX;
      tMaxX += tDeltaX;
    } else {
      ty += stepY;
      tMaxY += tDeltaY;
    }
    if (!walkable(grid, w, h, tx, ty)) return false;
  }
  return true;
}
