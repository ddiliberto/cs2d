// Circle-AABB, line-AABB, line-of-sight collision detection

import { MAP_W, MAP_H } from './config.js';
import { walls, BOMBSITE_A, BOMBSITE_B } from './map-data.js';

export function rectContains(r, px, py) {
  return px > r[0] && px < r[0] + r[2] && py > r[1] && py < r[1] + r[3];
}

export function lineIntersectsRect(x1, y1, x2, y2, r) {
  const l = r[0], t = r[1], ri = r[0] + r[2], b = r[1] + r[3];

  function ccw(ax, ay, bx, by, cx, cy) {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  }

  function seg(ax, ay, bx, by, cx, cy, dx, dy) {
    return ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
           ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy);
  }

  const edges = [
    [l, t, ri, t],
    [ri, t, ri, b],
    [ri, b, l, b],
    [l, b, l, t],
  ];

  for (const e of edges) {
    if (seg(x1, y1, x2, y2, e[0], e[1], e[2], e[3])) return true;
  }

  if (x1 >= l && x1 <= ri && y1 >= t && y1 <= b) return true;
  return false;
}

export function canSee(x1, y1, x2, y2) {
  for (const w of walls) {
    if (lineIntersectsRect(x1, y1, x2, y2, w)) return false;
  }
  return true;
}

export function collideCircleWalls(x, y, r) {
  let nx = x, ny = y;

  for (let it = 0; it < 3; it++) {
    for (const w of walls) {
      const cx = Math.max(w[0], Math.min(nx, w[0] + w[2]));
      const cy = Math.max(w[1], Math.min(ny, w[1] + w[3]));
      const dx = nx - cx, dy = ny - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < r && dist > 0.001) {
        nx += (dx / dist) * (r - dist);
        ny += (dy / dist) * (r - dist);
      } else if (dist === 0) {
        const px2 = nx - (w[0] + w[2] / 2);
        const py2 = ny - (w[1] + w[3] / 2);
        const pm = Math.sqrt(px2 * px2 + py2 * py2) || 1;
        nx += (px2 / pm) * r;
        ny += (py2 / pm) * r;
      }
    }
  }

  nx = Math.max(r + 16, Math.min(MAP_W - r - 16, nx));
  ny = Math.max(r + 16, Math.min(MAP_H - r - 16, ny));
  return { x: nx, y: ny };
}

export function inBombsite(x, y) {
  const da = Math.sqrt((x - BOMBSITE_A.x) ** 2 + (y - BOMBSITE_A.y) ** 2);
  const db = Math.sqrt((x - BOMBSITE_B.x) ** 2 + (y - BOMBSITE_B.y) ** 2);

  if (da < BOMBSITE_A.r) return 'A';
  if (db < BOMBSITE_B.r) return 'B';
  return null;
}
