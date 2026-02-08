// Camera follow, spectate mode, free cam

import { MAP_W, MAP_H } from '../../shared/config.js';

let freeCamX = 0;
let freeCamY = 0;
let freeCamActive = false;
let dragStart = null;
let shakeX = 0;
let shakeY = 0;
let shakeIntensity = 0;
let spectateTarget = null;

export function getCameraPosition(player, W, H) {
  // Spectate mode - follow teammate
  if (spectateTarget && !player.alive) {
    return {
      x: spectateTarget.x - W / 2 + shakeX,
      y: spectateTarget.y - H / 2 + shakeY,
    };
  }

  if (freeCamActive && !player.alive) {
    return {
      x: freeCamX - W / 2 + shakeX,
      y: freeCamY - H / 2 + shakeY,
    };
  }

  return {
    x: player.x - W / 2 + shakeX,
    y: player.y - H / 2 + shakeY,
  };
}

export function enableFreeCam(x, y) {
  freeCamActive = true;
  freeCamX = x;
  freeCamY = y;
}

export function disableFreeCam() {
  freeCamActive = false;
  dragStart = null;
}

export function isFreeCamActive() {
  return freeCamActive;
}

export function startCameraDrag(x, y) {
  if (freeCamActive) {
    dragStart = { x, y, camX: freeCamX, camY: freeCamY };
  }
}

export function updateCameraDrag(x, y) {
  if (dragStart) {
    const dx = dragStart.x - x;
    const dy = dragStart.y - y;
    freeCamX = Math.max(400, Math.min(MAP_W - 400, dragStart.camX + dx));
    freeCamY = Math.max(300, Math.min(MAP_H - 300, dragStart.camY + dy));
  }
}

export function endCameraDrag() {
  dragStart = null;
}

export function jumpCameraTo(x, y) {
  if (freeCamActive) {
    freeCamX = Math.max(400, Math.min(MAP_W - 400, x));
    freeCamY = Math.max(300, Math.min(MAP_H - 300, y));
  }
}

export function addScreenShake(intensity) {
  shakeIntensity = Math.max(shakeIntensity, intensity);
}

export function updateScreenShake(dt) {
  if (shakeIntensity > 0) {
    shakeX = (Math.random() - 0.5) * shakeIntensity;
    shakeY = (Math.random() - 0.5) * shakeIntensity;
    shakeIntensity *= 0.92; // Decay
    if (shakeIntensity < 0.1) {
      shakeIntensity = 0;
      shakeX = 0;
      shakeY = 0;
    }
  }
}

export function setSpectateTarget(target) {
  spectateTarget = target;
  if (target) {
    freeCamActive = false; // Disable free cam when spectating
  }
}

export function getSpectateTarget() {
  return spectateTarget;
}
