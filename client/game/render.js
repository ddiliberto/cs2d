// All canvas drawing, fog compositing

import { MAP_W, MAP_H } from '../../shared/config.js';
import { walls, BOMBSITE_A, BOMBSITE_B } from '../../shared/map-data.js';
import { computeVisibilityPolygon, isVisibleToTeam, VIS_RANGE } from './visibility.js';
import { particles } from './particles.js';
import { moveStick } from './input.js';
import { PLANT_TIME, DEFUSE_TIME } from '../../shared/config.js';
import { getCameraPosition } from './camera.js';

let ctx, mmCtx, fogCtx;
let canvas, mmCanvas, fogCanvas;
let W, H;

export function initRender(onMinimapClick) {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  mmCanvas = document.getElementById('minimap');
  mmCtx = mmCanvas.getContext('2d');
  fogCanvas = document.createElement('canvas');
  fogCtx = fogCanvas.getContext('2d');

  resize();
  window.addEventListener('resize', resize);

  // Minimap click handler
  if (onMinimapClick) {
    mmCanvas.style.pointerEvents = 'auto';
    mmCanvas.addEventListener('click', e => {
      const rect = mmCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / 120 * MAP_W;
      const y = (e.clientY - rect.top) / 90 * MAP_H;
      onMinimapClick(x, y);
    });
    mmCanvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const rect = mmCanvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = (touch.clientX - rect.left) / 120 * MAP_W;
      const y = (touch.clientY - rect.top) / 90 * MAP_H;
      onMinimapClick(x, y);
    }, { passive: false });
  }
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
  fogCanvas.width = W;
  fogCanvas.height = H;
}

export function render(player, tBots, ctBots, bullets, bomb, visPolygon) {
  // Clear
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  const cam = getCameraPosition(player, W, H);
  const camX = cam.x;
  const camY = cam.y;
  ctx.save();
  ctx.translate(-camX, -camY);

  // Draw the world
  drawWorld();
  drawBombsites(bomb);
  drawWalls();
  drawBomb(bomb);
  drawParticles();
  drawBullets(bullets);
  drawBots(tBots, ctBots, player, bomb);
  drawPlayer(player, bomb);

  ctx.restore();

  // Fog of war
  drawFog(player, tBots, visPolygon, camX, camY);

  // UI overlays
  drawJoystick();
  drawMinimap(player, tBots, ctBots, bomb);
}

function drawWorld() {
  ctx.fillStyle = '#2a2518';
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.strokeStyle = 'rgba(255,255,255,.025)';
  ctx.lineWidth = 1;
  for (let x = 0; x < MAP_W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, MAP_H);
    ctx.stroke();
  }
  for (let y = 0; y < MAP_H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(MAP_W, y);
    ctx.stroke();
  }
}

function drawBombsites(bomb) {
  const bombFlash = bomb.planted && !bomb.exploded && !bomb.defused
    ? (0.5 + Math.sin(performance.now() / (bomb.detonateTimer < 10 ? 80 : 200)) * 0.5)
    : 1;

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = bomb.planted && bomb.site === 'A'
    ? `rgba(255,50,50,${0.15 + bombFlash * 0.15})`
    : '#ff3333';
  ctx.beginPath();
  ctx.arc(BOMBSITE_A.x, BOMBSITE_A.y, BOMBSITE_A.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bomb.planted && bomb.site === 'B'
    ? `rgba(255,50,50,${0.15 + bombFlash * 0.15})`
    : '#3388ff';
  ctx.beginPath();
  ctx.arc(BOMBSITE_B.x, BOMBSITE_B.y, BOMBSITE_B.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.font = 'bold 22px Courier New';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,80,80,.25)';
  ctx.fillText('A', BOMBSITE_A.x, BOMBSITE_A.y);
  ctx.fillStyle = 'rgba(0,136,255,.25)';
  ctx.fillText('B', BOMBSITE_B.x, BOMBSITE_B.y);
}

function drawWalls() {
  for (const w of walls) {
    ctx.fillStyle = '#5c5040';
    ctx.fillRect(w[0], w[1], w[2], w[3]);
    ctx.fillStyle = '#6d6050';
    ctx.fillRect(w[0], w[1], w[2], Math.min(2, w[3]));
  }
}

function drawBomb(bomb) {
  if (bomb.planted && !bomb.exploded) {
    const pulse = 0.7 + Math.sin(performance.now() / (bomb.detonateTimer < 10 ? 100 : 300)) * 0.3;
    ctx.fillStyle = `rgba(255,${bomb.detonateTimer < 10 ? 0 : 150},0,${pulse})`;
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f90';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 10px Courier New';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(bomb.detonateTimer) + 's', bomb.x, bomb.y - 14);

    if (bomb.defusing) {
      ctx.fillStyle = '#333';
      ctx.fillRect(bomb.x - 15, bomb.y + 12, 30, 4);
      ctx.fillStyle = '#4af';
      ctx.fillRect(bomb.x - 15, bomb.y + 12, 30 * (bomb.defuseProgress / DEFUSE_TIME), 4);
    }
  }

  if (bomb.dropped && !bomb.planted) {
    ctx.fillStyle = '#f90';
    ctx.beginPath();
    ctx.arc(bomb.dropX, bomb.dropY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (bomb.planting && bomb.planterRef === 'player') {
    // Draw at player position (passed in via player object)
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / 40;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBullets(bullets) {
  ctx.fillStyle = '#ffcc00';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBots(tBots, ctBots, player, bomb) {
  // Draw T bots (always visible - they're teammates)
  for (const b of tBots) {
    if (!b.alive && b.deathAlpha <= 0) continue; // Skip fully faded bodies

    // Apply death fade
    const alpha = b.alive ? 1.0 : b.deathAlpha;
    ctx.globalAlpha = alpha;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = '#cc8833';
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#aa7733';
    ctx.fillRect(4, -3, 10, 6);
    ctx.restore();

    if (b.hp < b.maxHp && b.alive) {
      const bw = 20;
      ctx.fillStyle = '#222';
      ctx.fillRect(b.x - bw / 2, b.y - 18, bw, 3);
      ctx.fillStyle = b.hp > 50 ? '#4c4' : '#c44';
      ctx.fillRect(b.x - bw / 2, b.y - 18, bw * (b.hp / b.maxHp), 3);
    }

    if (b.alive) {
      ctx.fillStyle = 'rgba(255,200,50,.5)';
      ctx.font = '8px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('T' + (b.id + 1), b.x, b.y - 22);

      if (bomb.carrier === b) {
        ctx.fillStyle = '#f90';
        ctx.font = 'bold 9px Courier New';
        ctx.fillText('BOMB', b.x, b.y + 22);
      }
    }

    ctx.globalAlpha = 1.0; // Reset alpha
  }

  // Draw CT bots (only if visible to team)
  for (const b of ctBots) {
    if (!b.alive && b.deathAlpha <= 0) continue;
    if (!isVisibleToTeam(b.x, b.y, player, tBots)) continue;

    // Apply death fade
    const alpha = b.alive ? 1.0 : b.deathAlpha;
    ctx.globalAlpha = alpha;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = '#3366aa';
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5588cc';
    ctx.fillRect(4, -3, 10, 6);
    ctx.restore();

    if (b.hp < b.maxHp && b.alive) {
      const bw = 20;
      ctx.fillStyle = '#222';
      ctx.fillRect(b.x - bw / 2, b.y - 18, bw, 3);
      ctx.fillStyle = b.hp > 50 ? '#4c4' : '#c44';
      ctx.fillRect(b.x - bw / 2, b.y - 18, bw * (b.hp / b.maxHp), 3);
    }

    ctx.globalAlpha = 1.0; // Reset alpha
  }
}

function drawPlayer(player, bomb) {
  if (!player.alive) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#e8a030';
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, player.r + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#aa7733';
  ctx.fillRect(4, -2, 13, 4);
  ctx.restore();

  // Crosshair
  const chD = 55;
  const chx = player.x + Math.cos(player.angle) * chD;
  const chy = player.y + Math.sin(player.angle) * chD;
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chx - 5, chy);
  ctx.lineTo(chx + 5, chy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(chx, chy - 5);
  ctx.lineTo(chx, chy + 5);
  ctx.stroke();

  if (bomb.carrier === 'player') {
    ctx.fillStyle = '#f90';
    ctx.font = 'bold 9px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('BOMB', player.x, player.y + 22);
  }

  // Reload indicator
  if (player.reloading) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('RELOADING...', player.x, player.y - 20);
  }

  // Plant progress bar
  if (bomb.planting && bomb.planterRef === 'player') {
    ctx.fillStyle = '#333';
    ctx.fillRect(player.x - 15, player.y + 16, 30, 4);
    ctx.fillStyle = '#f90';
    ctx.fillRect(player.x - 15, player.y + 16, 30 * (bomb.plantProgress / PLANT_TIME), 4);
  }
}

function drawFog(player, tBots, visPolygon, camX, camY) {
  // Darker, smoother fog
  fogCtx.fillStyle = 'rgba(0,0,0,0.92)';
  fogCtx.fillRect(0, 0, W, H);

  if (visPolygon.length > 2) {
    fogCtx.globalCompositeOperation = 'destination-out';

    // Draw player's visibility with smoother gradient
    if (player.alive) {
      drawVisPoly(fogCtx, player.x - camX, player.y - camY, visPolygon, camX, camY, 1.0);
    }

    // Draw teammate visibility (computed on the fly, simpler/smaller range)
    for (const tb of tBots) {
      if (!tb.alive) continue;
      const tbVis = computeVisibilityPolygon(tb.x, tb.y, VIS_RANGE * 0.7);
      if (tbVis.length > 2) {
        drawVisPoly(fogCtx, tb.x - camX, tb.y - camY, tbVis, camX, camY, 0.85);
      }
    }

    fogCtx.globalCompositeOperation = 'source-over';
  }

  // Apply fog with slight blur for elegant fade
  ctx.save();
  ctx.globalAlpha = 1.0;
  ctx.drawImage(fogCanvas, 0, 0);
  ctx.restore();
}

function drawVisPoly(fctx, sx, sy, poly, camX, camY, alpha) {
  // Draw a smoother radial gradient visibility polygon with elegant fade
  const grad = fctx.createRadialGradient(sx, sy, 0, sx, sy, VIS_RANGE);

  // Multi-stop gradient for smoother falloff
  grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
  grad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.95})`);
  grad.addColorStop(0.75, `rgba(255,255,255,${alpha * 0.7})`);
  grad.addColorStop(0.9, `rgba(255,255,255,${alpha * 0.3})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');

  fctx.fillStyle = grad;
  fctx.beginPath();
  fctx.moveTo(poly[0].x - camX, poly[0].y - camY);
  for (let i = 1; i < poly.length; i++) {
    fctx.lineTo(poly[i].x - camX, poly[i].y - camY);
  }
  fctx.closePath();
  fctx.fill();

  // Add subtle outer glow for softer edges
  fctx.globalAlpha = 0.3 * alpha;
  fctx.strokeStyle = grad;
  fctx.lineWidth = 8;
  fctx.stroke();
  fctx.globalAlpha = 1.0;
}

function drawJoystick() {
  if (moveStick.active) {
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(moveStick.cx, moveStick.cy, 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath();
    ctx.arc(moveStick.cx + moveStick.x * 40, moveStick.cy + moveStick.y * 40, 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMinimap(player, tBots, ctBots, bomb) {
  const mxs = 120 / MAP_W;
  const mys = 90 / MAP_H;

  mmCtx.fillStyle = '#0a0a0a';
  mmCtx.fillRect(0, 0, 120, 90);
  mmCtx.fillStyle = 'rgba(92,80,64,.5)';
  for (const w of walls) {
    mmCtx.fillRect(w[0] * mxs, w[1] * mys, Math.max(1, w[2] * mxs), Math.max(1, w[3] * mys));
  }

  if (player.alive) {
    mmCtx.fillStyle = '#fff';
    mmCtx.beginPath();
    mmCtx.arc(player.x * mxs, player.y * mys, 2.5, 0, Math.PI * 2);
    mmCtx.fill();
  }

  for (const b of tBots) {
    if (!b.alive) continue;
    mmCtx.fillStyle = '#c93';
    mmCtx.beginPath();
    mmCtx.arc(b.x * mxs, b.y * mys, 1.5, 0, Math.PI * 2);
    mmCtx.fill();
  }

  for (const b of ctBots) {
    if (!b.alive) continue;
    if (isVisibleToTeam(b.x, b.y, player, tBots)) {
      mmCtx.fillStyle = '#f44';
      mmCtx.beginPath();
      mmCtx.arc(b.x * mxs, b.y * mys, 1.5, 0, Math.PI * 2);
      mmCtx.fill();
    }
  }

  if (bomb.planted && !bomb.exploded) {
    mmCtx.fillStyle = Math.sin(performance.now() / 200) > 0 ? '#f90' : '#f00';
    mmCtx.beginPath();
    mmCtx.arc(bomb.x * mxs, bomb.y * mys, 3, 0, Math.PI * 2);
    mmCtx.fill();
  }
}
