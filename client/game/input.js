// Touch + keyboard/mouse input handlers

import { startCameraDrag, updateCameraDrag, endCameraDrag, isFreeCamActive } from './camera.js';

export const keys = {};
export let moveTouch = null;
export let aimTouch = null;
export const moveStick = { x: 0, y: 0, active: false, cx: 0, cy: 0 };
export let aimStart = null;
export let bombActionTouch = false;
export let shooting = false;
let cameraDragTouch = null;

export function initInput(canvas, player, buyMenuOpen, toggleBuyMenu) {
  // Touch input
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();

    // If dead and free cam is active, allow camera dragging
    if (!player.alive && isFreeCamActive()) {
      const t = e.changedTouches[0];
      cameraDragTouch = t.identifier;
      startCameraDrag(t.clientX, t.clientY);
      return;
    }

    if (!player.alive || buyMenuOpen()) return;
    for (const t of e.changedTouches) {
      const W = window.innerWidth;
      if (t.clientX < W * 0.45) {
        moveTouch = t.identifier;
        moveStick.cx = t.clientX;
        moveStick.cy = t.clientY;
        moveStick.active = true;
      } else {
        aimTouch = t.identifier;
        aimStart = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      // Camera drag for dead player
      if (t.identifier === cameraDragTouch) {
        updateCameraDrag(t.clientX, t.clientY);
        continue;
      }

      if (t.identifier === moveTouch) {
        moveStick.x = (t.clientX - moveStick.cx) / 50;
        moveStick.y = (t.clientY - moveStick.cy) / 50;
        const m = Math.sqrt(moveStick.x ** 2 + moveStick.y ** 2);
        if (m > 1) {
          moveStick.x /= m;
          moveStick.y /= m;
        }
      }
      if (t.identifier === aimTouch && aimStart) {
        const dx = t.clientX - aimStart.x;
        if (Math.abs(dx) > 3) {
          player.angle += dx * 0.008;
          aimStart.x = t.clientX;
          aimStart.y = t.clientY;
        }
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === cameraDragTouch) {
        cameraDragTouch = null;
        endCameraDrag();
      }
      if (t.identifier === moveTouch) {
        moveTouch = null;
        moveStick.x = 0;
        moveStick.y = 0;
        moveStick.active = false;
        moveStick.cx = 0;
        moveStick.cy = 0;
      }
      if (t.identifier === aimTouch) {
        aimTouch = null;
        aimStart = null;
      }
    }
  }, { passive: false });

  // Keyboard input
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'b') toggleBuyMenu();
    // Weapon switching: 1=primary, 2=secondary, 3=knife
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      keys['weapon_' + e.key] = true;
    }
  });
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  // Mouse input
  let mouseDown = false;
  canvas.addEventListener('mousemove', e => {
    if (mouseDown && isFreeCamActive() && !player.alive) {
      updateCameraDrag(e.clientX, e.clientY);
      return;
    }

    if (player.alive) {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const cx = player.x - W / 2;
      const cy = player.y - H / 2;
      player.angle = Math.atan2(e.clientY + cy - player.y, e.clientX + cx - player.x);
    }
  });
  canvas.addEventListener('mousedown', e => {
    if (isFreeCamActive() && !player.alive) {
      mouseDown = true;
      startCameraDrag(e.clientX, e.clientY);
    } else {
      shooting = true;
    }
  });
  canvas.addEventListener('mouseup', () => {
    if (mouseDown) {
      mouseDown = false;
      endCameraDrag();
    }
    shooting = false;
  });
}

export function initBombActionInput(bombActionEl) {
  bombActionEl.addEventListener('touchstart', e => {
    e.stopPropagation();
    e.preventDefault();
    bombActionTouch = true;
  }, { passive: false });

  bombActionEl.addEventListener('touchend', e => {
    e.stopPropagation();
    e.preventDefault();
    bombActionTouch = false;
  }, { passive: false });

  bombActionEl.addEventListener('mousedown', e => {
    e.stopPropagation();
    bombActionTouch = true;
  });

  bombActionEl.addEventListener('mouseup', e => {
    e.stopPropagation();
    bombActionTouch = false;
  });
}

export function getMoveInput() {
  let mx = moveStick.x, my = moveStick.y;
  if (keys['w']) my = -1;
  if (keys['s']) my = 1;
  if (keys['a']) mx = -1;
  if (keys['d']) mx = 1;
  return { mx, my };
}

export function isReloading() {
  return keys['r'];
}

export function isBombActionPressed() {
  return bombActionTouch || keys['e'] || keys[' '];
}

export function resetMoveStick() {
  moveStick.x = 0;
  moveStick.y = 0;
  moveStick.active = false;
}

export function getWeaponSwitch() {
  if (keys['weapon_1']) {
    keys['weapon_1'] = false;
    return 1;
  }
  if (keys['weapon_2']) {
    keys['weapon_2'] = false;
    return 2;
  }
  if (keys['weapon_3']) {
    keys['weapon_3'] = false;
    return 3;
  }
  return 0;
}
