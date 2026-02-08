// DOM-based HUD, buy menu, kill feed

import { WEAPONS, T_BUY } from '../../shared/weapons.js';
import { KEVLAR_COST, HELMET_COST } from '../../shared/config.js';

export const killMessages = [];
let buyMenuOpen = false;

export function isBuyMenuOpen() {
  return buyMenuOpen;
}

export function toggleBuyMenu(phase, player, round) {
  if (phase !== 'buy' && phase !== 'freeze') return;
  buyMenuOpen = !buyMenuOpen;
  document.getElementById('buy-menu').style.display = buyMenuOpen ? 'block' : 'none';
  if (buyMenuOpen) renderBuyMenu(player, round);
}

export function closeBuyMenu() {
  buyMenuOpen = false;
  document.getElementById('buy-menu').style.display = 'none';
}

export function renderBuyMenu(player, round) {
  document.getElementById('buy-money').textContent = '$' + player.money;
  const c = document.getElementById('buy-items');
  c.innerHTML = '';

  // Pistol rounds: 1 and 13 (half-time)
  const isPistolRound = round === 1 || round === 13;
  const availableWeapons = isPistolRound ? ['glock', 'usp'] : T_BUY;

  for (const wid of availableWeapons) {
    const w = WEAPONS[wid];
    const owned = player.weapon === wid;
    const cb = player.money >= w.cost && !owned;
    const d = document.createElement('div');
    d.className = 'buy-item' + (owned ? ' owned' : '');

    if (isPistolRound && wid !== 'glock') {
      // Show other pistols in pistol round
      d.innerHTML = `<span>${w.name}</span><span class="${cb || owned ? 'price' : 'cant'}">${owned ? 'OWNED' : '$' + w.cost}</span>`;
    } else {
      d.innerHTML = `<span>${w.name}</span><span class="${cb || owned ? 'price' : 'cant'}">${owned ? 'OWNED' : '$' + w.cost}</span>`;
    }

    if (cb) {
      d.addEventListener('click', () => buyWeapon(wid, player));
      d.addEventListener('touchstart', e => {
        e.stopPropagation();
        buyWeapon(wid, player);
      });
    }
    c.appendChild(d);
  }

  // Add armor section
  if (!isPistolRound) {
    const armorHeader = document.createElement('div');
    armorHeader.style.cssText = 'margin-top:12px;font-size:12px;color:#aaa;text-align:center;';
    armorHeader.textContent = 'ARMOR';
    c.appendChild(armorHeader);

    // Kevlar
    const kevlarItem = document.createElement('div');
    const hasKevlar = player.hasKevlar;
    const canBuyKevlar = player.money >= KEVLAR_COST && !hasKevlar;
    kevlarItem.className = 'buy-item' + (hasKevlar ? ' owned' : '');
    kevlarItem.innerHTML = `<span>Kevlar</span><span class="${canBuyKevlar || hasKevlar ? 'price' : 'cant'}">${hasKevlar ? 'OWNED' : '$' + KEVLAR_COST}</span>`;
    if (canBuyKevlar) {
      kevlarItem.addEventListener('click', () => buyArmor('kevlar', player));
      kevlarItem.addEventListener('touchstart', e => {
        e.stopPropagation();
        buyArmor('kevlar', player);
      });
    }
    c.appendChild(kevlarItem);

    // Helmet (includes kevlar)
    const helmetItem = document.createElement('div');
    const hasHelmet = player.hasHelmet;
    const canBuyHelmet = player.money >= HELMET_COST && !hasHelmet;
    helmetItem.className = 'buy-item' + (hasHelmet ? ' owned' : '');
    helmetItem.innerHTML = `<span>Helmet + Kevlar</span><span class="${canBuyHelmet || hasHelmet ? 'price' : 'cant'}">${hasHelmet ? 'OWNED' : '$' + HELMET_COST}</span>`;
    if (canBuyHelmet) {
      helmetItem.addEventListener('click', () => buyArmor('helmet', player));
      helmetItem.addEventListener('touchstart', e => {
        e.stopPropagation();
        buyArmor('helmet', player);
      });
    }
    c.appendChild(helmetItem);
  }

  if (isPistolRound) {
    const notice = document.createElement('div');
    notice.style.cssText = 'text-align:center;color:#f90;font-size:11px;margin-top:10px;';
    notice.textContent = 'PISTOL ROUND';
    c.appendChild(notice);
  }
}

export function buyArmor(type, player) {
  if (type === 'kevlar') {
    if (player.money < KEVLAR_COST || player.hasKevlar) return;
    player.money -= KEVLAR_COST;
    player.hasKevlar = true;
  } else if (type === 'helmet') {
    if (player.money < HELMET_COST || player.hasHelmet) return;
    player.money -= HELMET_COST;
    player.hasKevlar = true;
    player.hasHelmet = true;
  }
  renderBuyMenu(player, window._currentRound || 1);
}

export function buyWeapon(wid, player) {
  const w = WEAPONS[wid];
  if (player.money < w.cost) return;
  player.money -= w.cost;

  // Determine if it's a primary or secondary weapon
  const isPistol = wid === 'glock' || wid === 'usp';

  if (isPistol) {
    player.secondaryWeapon = wid;
    player.secondaryAmmo = w.clip;
    player.secondaryReserve = w.reserve;
  } else {
    player.primaryWeapon = wid;
    player.primaryAmmo = w.clip;
    player.primaryReserve = w.reserve;
  }

  // Equip the weapon
  player.weapon = wid;
  player.ammo = w.clip;
  player.reserve = w.reserve;
  player.reloading = false;
  player.reloadTime = w.reload;
  renderBuyMenu(player);
}

export function addKill(k, v, t) {
  killMessages.unshift({ text: `${k} > ${v}`, time: 4000, team: t });
  if (killMessages.length > 5) killMessages.pop();
}

export function updateKillFeed(dt) {
  for (let i = killMessages.length - 1; i >= 0; i--) {
    killMessages[i].time -= dt;
    if (killMessages[i].time <= 0) killMessages.splice(i, 1);
  }
}

export function updateHUD(player, phase, phaseTimer, roundTimer, round, tRounds, ctRounds, bomb) {
  // Health and money
  document.getElementById('health').textContent = `HP: ${Math.max(0, player.hp)} | $${player.money}`;

  // Ammo
  const pw = WEAPONS[player.weapon];
  document.getElementById('ammo').textContent = player.reloading
    ? `${pw.name} | RELOADING`
    : `${pw.name} | ${player.ammo}/${player.reserve}`;

  // Round info
  const tl = phase === 'live' ? roundTimer : (phase === 'buy' || phase === 'freeze') ? phaseTimer : 0;
  const mins = Math.floor(Math.max(0, tl) / 60);
  const secs = Math.floor(Math.max(0, tl) % 60);
  let phaseLabel = phase === 'freeze' ? 'FREEZE' : phase === 'buy' ? 'BUY' : phase === 'live' ? (bomb.planted ? 'BOMB PLANTED' : 'LIVE') : '';
  document.getElementById('round-info').textContent = `R${round} ${phaseLabel} | T ${tRounds}:${ctRounds} CT | ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  document.getElementById('round-info').style.color = bomb.planted && phase === 'live' ? '#f44' : '#fff';

  // Kill feed
  document.getElementById('killfeed').innerHTML = killMessages.map(m => `<div class="${m.team.toLowerCase()}-kill">${m.text}</div>`).join('');
}

export function updateBombActionUI(bomb, isMoving) {
  const bombActionEl = document.getElementById('bomb-action');
  if (bomb.planting && bomb.planterRef === 'player') {
    bombActionEl.style.display = 'block';
    document.getElementById('bomb-action-text').textContent = isMoving ? 'HOLD TO PLANT' : 'PLANTING...';
    document.getElementById('bomb-bar').style.width = (bomb.plantProgress / 3.2 * 100) + '%';
  } else {
    document.getElementById('bomb-bar').style.width = '0%';
  }
}

export function showBombAction() {
  document.getElementById('bomb-action').style.display = 'block';
  document.getElementById('bomb-action-text').textContent = 'HOLD TO PLANT';
}

export function hideBombAction() {
  document.getElementById('bomb-action').style.display = 'none';
}

export function showCenterMessage(content) {
  const msg = document.getElementById('center-msg');
  msg.innerHTML = content;
  msg.style.display = 'block';
}

export function hideCenterMessage() {
  document.getElementById('center-msg').style.display = 'none';
}

export function initBuyMenuListeners(player) {
  document.getElementById('buy-close').addEventListener('click', () => {
    closeBuyMenu();
  });

  document.getElementById('buy-close').addEventListener('touchstart', e => {
    e.stopPropagation();
    closeBuyMenu();
  });
}

export function initCenterMessageListeners(restartGame) {
  const msg = document.getElementById('center-msg');
  msg.addEventListener('click', restartGame);
  msg.addEventListener('touchstart', e => {
    e.stopPropagation();
    restartGame();
  });
}
