// Raycasting, visibility polygon, fog-of-war

import { walls } from '../../shared/map-data.js';
import { canSee } from '../../shared/collision.js';
import { VIS_RANGE } from '../../shared/config.js';

let wallSegments = [];
let wallPoints = [];

// Build wall segments for raycasting
export function buildWallSegments() {
  wallSegments = [];
  for (const w of walls) {
    const l = w[0], t = w[1], r = w[0] + w[2], b = w[1] + w[3];
    wallSegments.push({ x1: l, y1: t, x2: r, y2: t });
    wallSegments.push({ x1: r, y1: t, x2: r, y2: b });
    wallSegments.push({ x1: r, y1: b, x2: l, y2: b });
    wallSegments.push({ x1: l, y1: b, x2: l, y2: t });
  }
}

// Collect unique endpoints for raycasting
function getUniquePoints() {
  const pts = new Set();
  for (const s of wallSegments) {
    pts.add(s.x1 + ',' + s.y1);
    pts.add(s.x2 + ',' + s.y2);
  }
  return Array.from(pts).map(p => {
    const [x, y] = p.split(',');
    return { x: +x, y: +y };
  });
}

function raySegmentIntersect(rx, ry, rdx, rdy, sx1, sy1, sx2, sy2) {
  const dx = sx2 - sx1, dy = sy2 - sy1;
  const den = rdx * dy - rdy * dx;
  if (Math.abs(den) < 1e-10) return null;
  const t2 = (rdx * (sy1 - ry) - rdy * (sx1 - rx)) / den;
  const t1 = (dx * (ry - sy1) - dy * (rx - sx1)) / (-den);
  if (t1 < 0 || t2 < 0 || t2 > 1) return null;
  return { x: rx + rdx * t1, y: ry + rdy * t1, t: t1 };
}

function castRay(ox, oy, angle) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let closest = null, minT = Infinity;
  for (const s of wallSegments) {
    const hit = raySegmentIntersect(ox, oy, dx, dy, s.x1, s.y1, s.x2, s.y2);
    if (hit && hit.t < minT) {
      minT = hit.t;
      closest = hit;
    }
  }
  return closest || { x: ox + dx * 2000, y: oy + dy * 2000, t: 2000 };
}

export function computeVisibilityPolygon(ox, oy, maxDist) {
  // Cast rays toward every wall corner with tiny offsets
  const angles = [];
  for (const p of wallPoints) {
    const dx = p.x - ox, dy = p.y - oy;
    if (dx * dx + dy * dy > maxDist * maxDist) continue;
    const a = Math.atan2(dy, dx);
    angles.push(a - 0.0001, a, a + 0.0001);
  }
  // Also cast evenly around to fill gaps
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 32) {
    angles.push(a);
  }

  angles.sort((a, b) => a - b);

  const pts = [];
  for (const a of angles) {
    const hit = castRay(ox, oy, a);
    const dx = hit.x - ox, dy = hit.y - oy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxDist) {
      pts.push({ x: ox + Math.cos(a) * maxDist, y: oy + Math.sin(a) * maxDist, a });
    } else {
      pts.push({ x: hit.x, y: hit.y, a });
    }
  }
  pts.sort((a, b) => a.a - b.a);
  return pts;
}

// Check if point is visible to any teammate
export function isVisibleToTeam(px, py, player, tBots) {
  if (player.alive && canSee(player.x, player.y, px, py)) {
    const d = Math.sqrt((px - player.x) ** 2 + (py - player.y) ** 2);
    if (d < VIS_RANGE) return true;
  }
  for (const b of tBots) {
    if (!b.alive) continue;
    const d = Math.sqrt((px - b.x) ** 2 + (py - b.y) ** 2);
    if (d < VIS_RANGE && canSee(b.x, b.y, px, py)) return true;
  }
  return false;
}

// Initialize wall points after building segments
export function initVisibility() {
  buildWallSegments();
  wallPoints = getUniquePoints();
}

export { VIS_RANGE };
