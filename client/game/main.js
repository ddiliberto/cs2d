// Game loop, state management, bot AI, round system, bomb logic

import { WEAPONS } from '../../shared/weapons.js';
import { T_SPAWNS, CT_SPAWNS, BOMBSITE_A, BOMBSITE_B, PATROL_T, PATROL_CT } from '../../shared/map-data.js';
import { collideCircleWalls, canSee, inBombsite, rectContains } from '../../shared/collision.js';
import {
  ROUND_TIME, BUY_TIME, FREEZE_TIME, MAX_ROUNDS, PLANT_TIME, DEFUSE_TIME, BOMB_TIMER,
  PLAYER_RADIUS, BOT_RADIUS, PLAYER_SPEED, KILL_REWARD, WIN_REWARD, LOSS_BONUS, MAX_MONEY, START_MONEY,
  KEVLAR_PROTECTION
} from '../../shared/config.js';
import { initVisibility, computeVisibilityPolygon, VIS_RANGE } from './visibility.js';
import { initRender, render } from './render.js';
import { initInput, getMoveInput, isReloading, isBombActionPressed, getWeaponSwitch, keys, shooting } from './input.js';
import { particles, addBlood, addExplosion, addMuzzleFlash, updateParticles } from './particles.js';
import {
  isBuyMenuOpen, toggleBuyMenu, closeBuyMenu, addKill, updateKillFeed, updateHUD,
  showBombAction, hideBombAction, updateBombActionUI, showCenterMessage, hideCenterMessage,
  initBuyMenuListeners, initCenterMessageListeners
} from './hud.js';
import { initBombActionInput } from './input.js';
import { walls } from '../../shared/map-data.js';
import { enableFreeCam, disableFreeCam, jumpCameraTo, addScreenShake, updateScreenShake, setSpectateTarget, getSpectateTarget } from './camera.js';

// Game state
let round = 1;
let tRounds = 0;
let ctRounds = 0;
let tConsecutiveLosses = 0;
let ctConsecutiveLosses = 0;
let roundTimer = 0;
let phase = 'freeze';
let phaseTimer = 0;
let gameOver = false;
let sidesSwapped = false;

// Bomb state
let bomb = {
  carrier: 'player',
  planted: false,
  plantProgress: 0,
  planting: false,
  planterRef: null,
  defuseProgress: 0,
  defusing: false,
  defuserRef: null,
  detonateTimer: 0,
  x: 0,
  y: 0,
  site: '',
  exploded: false,
  defused: false,
  dropX: 0,
  dropY: 0,
  dropped: false,
};

function resetBomb() {
  bomb = {
    carrier: 'player',
    planted: false,
    plantProgress: 0,
    planting: false,
    planterRef: null,
    defuseProgress: 0,
    defusing: false,
    defuserRef: null,
    detonateTimer: 0,
    x: 0,
    y: 0,
    site: '',
    exploded: false,
    defused: false,
    dropX: 0,
    dropY: 0,
    dropped: false,
  };
}

// Player
const player = {
  x: 0,
  y: 0,
  angle: -Math.PI / 2,
  r: PLAYER_RADIUS,
  hp: 100,
  maxHp: 100,
  alive: true,
  weapon: 'glock',
  primaryWeapon: null, // AK, AWP, MP5, etc.
  secondaryWeapon: 'glock', // Pistol
  primaryAmmo: 0,
  primaryReserve: 0,
  secondaryAmmo: 20,
  secondaryReserve: 40,
  ammo: 20,
  reserve: 40,
  hasKevlar: false,
  hasHelmet: false,
  reloading: false,
  reloadTime: 2200,
  reloadStart: 0,
  lastShot: 0,
  team: 'T',
  kills: 0,
  deaths: 0,
  money: START_MONEY,
  deathAlpha: 1.0,
};

function playerWep() {
  return WEAPONS[player.weapon];
}

// Bots
let tBots = [];
let ctBots = [];

function createBot(team, id) {
  const spawns = team === 'T' ? T_SPAWNS : CT_SPAWNS;
  const sp = spawns[(id + (team === 'T' ? 1 : 0)) % spawns.length];
  const def = team === 'T' ? 'glock' : 'usp';
  const w = WEAPONS[def];
  return {
    x: sp.x + (Math.random() - 0.5) * 30,
    y: sp.y + (Math.random() - 0.5) * 30,
    angle: team === 'T' ? -Math.PI / 2 : Math.PI,
    r: BOT_RADIUS,
    hp: 100,
    maxHp: 100,
    alive: true,
    team,
    id,
    state: 'patrol',
    targetX: 0,
    targetY: 0,
    lastShot: 0,
    fireRate: w.rate + 80,
    patrolTimer: 0,
    alertTimer: 0,
    weapon: def,
    dmg: w.dmg,
    spread: w.spread + 0.04,
    money: START_MONEY,
    deathAlpha: 1.0, // For death fade-out
  };
}

function initBots() {
  tBots = [];
  ctBots = [];
  for (let i = 0; i < 4; i++) tBots.push(createBot('T', i));
  for (let i = 0; i < 5; i++) ctBots.push(createBot('CT', i));
}

function allBots() {
  return [...tBots, ...ctBots];
}

function enemiesOf(t) {
  return t === 'T' ? ctBots : tBots;
}

function teamAlive(t) {
  let c = (t === 'T' ? tBots : ctBots).filter(b => b.alive).length;
  if (t === 'T' && player.alive) c++;
  return c;
}

// Bullets
let bullets = [];

// Visibility
let visPolygon = [];
let visUpdateTimer = 0;

function updateVisibility() {
  // Combine player + teammate vision
  const viewers = [];
  if (player.alive) viewers.push({ x: player.x, y: player.y });
  for (const b of tBots) {
    if (b.alive) viewers.push({ x: b.x, y: b.y });
  }

  // For rendering we use player's own polygon primarily
  if (player.alive) {
    visPolygon = computeVisibilityPolygon(player.x, player.y, VIS_RANGE);
  } else if (viewers.length > 0) {
    visPolygon = computeVisibilityPolygon(viewers[0].x, viewers[0].y, VIS_RANGE);
  }
}

function swapSides() {
  // Swap player team
  player.team = player.team === 'T' ? 'CT' : 'T';
  player.weapon = player.team === 'T' ? 'glock' : 'usp';

  // Swap all bot teams
  const oldTBots = [...tBots];
  const oldCTBots = [...ctBots];

  tBots = oldCTBots.map(b => ({ ...b, team: 'T' }));
  ctBots = oldTBots.map(b => ({ ...b, team: 'CT' }));

  // Show message
  showCenterMessage('<span class="win">HALF-TIME - SIDES SWAPPED</span><div class="sub">T and CT switch sides</div>');
  setTimeout(() => hideCenterMessage(), 3000);
}

// Round management
function startRound() {
  // Half-time side swap at round 13
  if (round === 13 && !sidesSwapped) {
    swapSides();
    sidesSwapped = true;
  }

  phase = 'freeze';
  phaseTimer = FREEZE_TIME;
  roundTimer = ROUND_TIME;
  bullets = [];
  resetBomb();

  const spawns = player.team === 'T' ? T_SPAWNS : CT_SPAWNS;
  const sp = spawns[0];
  player.x = sp.x;
  player.y = sp.y;
  player.angle = player.team === 'T' ? -Math.PI / 2 : Math.PI;
  player.hp = player.maxHp;
  player.alive = true;
  player.reloading = false;
  player.deathAlpha = 1.0;
  player.hasKevlar = false;
  player.hasHelmet = false;
  disableFreeCam();
  const pw = playerWep();
  player.ammo = pw.clip;
  player.reserve = pw.reserve;

  for (const b of tBots) {
    const bsp = T_SPAWNS[(b.id + 1) % T_SPAWNS.length];
    b.x = bsp.x + (Math.random() - 0.5) * 30;
    b.y = bsp.y + (Math.random() - 0.5) * 30;
    b.hp = b.maxHp;
    b.alive = true;
    b.state = 'patrol';
    b.alertTimer = 0;
    b.deathAlpha = 1.0;
    botBuyWeapon(b);
  }

  for (const b of ctBots) {
    const bsp = CT_SPAWNS[b.id % CT_SPAWNS.length];
    b.x = bsp.x + (Math.random() - 0.5) * 30;
    b.y = bsp.y + (Math.random() - 0.5) * 30;
    b.hp = b.maxHp;
    b.alive = true;
    b.state = 'patrol';
    b.alertTimer = 0;
    b.deathAlpha = 1.0;
    botBuyWeapon(b);
  }

  hideCenterMessage();
  closeBuyMenu();
  hideBombAction();
}

function botBuyWeapon(bot) {
  const list = bot.team === 'T' ? ['ak47', 'mp5', 'glock'] : ['m4a1', 'mp5', 'usp'];
  for (const wid of list) {
    const w = WEAPONS[wid];
    if (bot.money >= w.cost) {
      bot.money -= w.cost;
      bot.weapon = wid;
      bot.dmg = w.dmg;
      bot.fireRate = w.rate + 60 + Math.random() * 40;
      bot.spread = w.spread + 0.04;
      return;
    }
  }
  const def = bot.team === 'T' ? 'glock' : 'usp';
  const dw = WEAPONS[def];
  bot.weapon = def;
  bot.dmg = dw.dmg;
  bot.fireRate = dw.rate + 80;
  bot.spread = dw.spread + 0.04;
}

function endRound(winner) {
  phase = 'roundEnd';
  phaseTimer = 3;

  if (winner === 'T') {
    tRounds++;
    ctConsecutiveLosses = Math.min(ctConsecutiveLosses + 1, LOSS_BONUS.length - 1);
    tConsecutiveLosses = 0;
    const lossBonus = LOSS_BONUS[ctConsecutiveLosses];
    awardMoney('T', WIN_REWARD, 'CT', lossBonus);
  } else {
    ctRounds++;
    tConsecutiveLosses = Math.min(tConsecutiveLosses + 1, LOSS_BONUS.length - 1);
    ctConsecutiveLosses = 0;
    const lossBonus = LOSS_BONUS[tConsecutiveLosses];
    awardMoney('CT', WIN_REWARD, 'T', lossBonus);
  }

  const pWin = winner === player.team;
  const content = `<span class="${pWin ? 'win' : 'lose'}">${winner} WINS ROUND ${round}</span><div class="sub">T ${tRounds} : ${ctRounds} CT</div>`;
  showCenterMessage(content);
  hideBombAction();

  const needed = Math.ceil((MAX_ROUNDS + 1) / 2);
  if (tRounds >= needed || ctRounds >= needed) {
    gameOver = true;
    const mW = tRounds >= needed ? 'T' : 'CT';
    const matchContent = `<span class="${mW === player.team ? 'win' : 'lose'}">${mW} WINS THE MATCH</span><div class="sub">T ${tRounds} : ${ctRounds} CT</div><div class="sub">Tap to restart</div>`;
    showCenterMessage(matchContent);
    document.getElementById('center-msg').style.pointerEvents = 'auto';
  }
}

function awardMoney(wt, wa, lt, la) {
  player.money = Math.min(MAX_MONEY, player.money + (player.team === wt ? wa : la));
  for (const b of allBots()) {
    b.money = Math.min(MAX_MONEY, b.money + (b.team === wt ? wa : la));
  }
}

function restartGame() {
  if (gameOver) {
    gameOver = false;
    round = 1;
    tRounds = 0;
    ctRounds = 0;
    tConsecutiveLosses = 0;
    ctConsecutiveLosses = 0;
    sidesSwapped = false;
    player.team = 'T';
    player.money = START_MONEY;
    player.weapon = 'glock';
    for (const b of allBots()) b.money = START_MONEY;
    startRound();
  }
}

// Combat
function shootBullet(shooter, isPlayer) {
  const now = performance.now();
  const w = isPlayer ? playerWep() : WEAPONS[shooter.weapon] || WEAPONS.glock;
  const rate = isPlayer ? w.rate : shooter.fireRate;
  if (now - shooter.lastShot < rate) return;
  if (isPlayer && player.reloading) return;
  if (isPlayer && player.ammo <= 0) {
    reload();
    return;
  }

  shooter.lastShot = now;
  if (isPlayer) player.ammo--;

  const spread = isPlayer ? w.spread : shooter.spread;
  const a = shooter.angle + (Math.random() - 0.5) * spread;
  bullets.push({
    x: shooter.x,
    y: shooter.y,
    vx: Math.cos(a) * 14,
    vy: Math.sin(a) * 14,
    team: shooter.team,
    isPlayer,
    life: 50,
    dmg: isPlayer ? w.dmg : shooter.dmg,
  });

  // Muzzle flash
  addMuzzleFlash(shooter.x, shooter.y, shooter.angle);
}

function reload() {
  const w = playerWep();
  if (player.reloading || player.reserve <= 0 || player.ammo === w.clip) return;
  player.reloading = true;
  player.reloadStart = performance.now();
}

function switchWeapon(slot) {
  // Save current weapon's ammo
  if (player.weapon === player.primaryWeapon && player.primaryWeapon) {
    player.primaryAmmo = player.ammo;
    player.primaryReserve = player.reserve;
  } else if (player.weapon === player.secondaryWeapon) {
    player.secondaryAmmo = player.ammo;
    player.secondaryReserve = player.reserve;
  }

  // Switch to new weapon
  if (slot === 1 && player.primaryWeapon) {
    player.weapon = player.primaryWeapon;
    player.ammo = player.primaryAmmo || 0;
    player.reserve = player.primaryReserve || 0;
  } else if (slot === 2 && player.secondaryWeapon) {
    player.weapon = player.secondaryWeapon;
    player.ammo = player.secondaryAmmo || 0;
    player.reserve = player.secondaryReserve || 0;
  } else if (slot === 3) {
    player.weapon = 'knife';
    player.ammo = 999;
    player.reserve = 0;
  }

  player.reloading = false;
  const w = playerWep();
  player.reloadTime = w.reload;
}

// Bot AI
function updateBot(bot, dt) {
  if (!bot.alive || phase === 'freeze') return;

  const enemies = enemiesOf(bot.team);
  let best = null;
  let bestD = 400;

  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.sqrt((e.x - bot.x) ** 2 + (e.y - bot.y) ** 2);
    if (d < bestD && canSee(bot.x, bot.y, e.x, e.y)) {
      best = e;
      bestD = d;
    }
  }

  if (bot.team === 'CT' && player.alive) {
    const d = Math.sqrt((player.x - bot.x) ** 2 + (player.y - bot.y) ** 2);
    if (d < bestD && canSee(bot.x, bot.y, player.x, player.y)) {
      best = { x: player.x, y: player.y };
      bestD = d;
    }
  }

  // CT defuse behavior
  if (bot.team === 'CT' && bomb.planted && !bomb.defused && !bomb.exploded) {
    const dbomb = Math.sqrt((bomb.x - bot.x) ** 2 + (bomb.y - bot.y) ** 2);
    if (!best && dbomb < 400) {
      bot.angle = Math.atan2(bomb.y - bot.y, bomb.x - bot.x);
      if (dbomb > 20) {
        bot.x += Math.cos(bot.angle) * 1.4;
        bot.y += Math.sin(bot.angle) * 1.4;
      } else {
        if (!bomb.defusing || bomb.defuserRef === bot) {
          bomb.defusing = true;
          bomb.defuserRef = bot;
        }
      }
      const col = collideCircleWalls(bot.x, bot.y, bot.r);
      bot.x = col.x;
      bot.y = col.y;
      return;
    }
  }

  if (best) {
    bot.state = 'engage';
    bot.alertTimer = 3000;
    bot.angle = Math.atan2(best.y - bot.y, best.x - bot.x);
    if (bestD > 80) {
      bot.x += Math.cos(bot.angle) * 1.3;
      bot.y += Math.sin(bot.angle) * 1.3;
    }
    if (bomb.defuserRef === bot) {
      bomb.defusing = false;
      bomb.defuserRef = null;
      bomb.defuseProgress = 0;
    }
    shootBullet(bot, false);
  } else {
    bot.alertTimer -= dt;
    if (bot.alertTimer > 0) {
      bot.state = 'search';
      bot.x += Math.cos(bot.angle) * 0.8;
      bot.y += Math.sin(bot.angle) * 0.8;
    } else {
      bot.state = 'patrol';
      bot.patrolTimer -= dt;
      let pts = bot.team === 'T' ? PATROL_T : PATROL_CT;
      if (bot.team === 'CT' && bomb.planted) {
        pts = [{ x: bomb.x, y: bomb.y }];
      }
      if (bot.patrolTimer <= 0) {
        const pt = pts[Math.floor(Math.random() * pts.length)];
        bot.targetX = pt.x + (Math.random() - 0.5) * 80;
        bot.targetY = pt.y + (Math.random() - 0.5) * 80;
        bot.patrolTimer = 2000 + Math.random() * 3000;
      }
      const dx = bot.targetX - bot.x;
      const dy = bot.targetY - bot.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 10) {
        bot.angle = Math.atan2(dy, dx);
        bot.x += Math.cos(bot.angle) * 0.9;
        bot.y += Math.sin(bot.angle) * 0.9;
      }
    }
  }

  const col = collideCircleWalls(bot.x, bot.y, bot.r);
  bot.x = col.x;
  bot.y = col.y;
}

// Main update loop
let lastTime = performance.now();

function update() {
  const now = performance.now();
  const dt = now - lastTime;
  lastTime = now;

  if (gameOver) return;

  // Phase management
  phaseTimer -= dt / 1000;
  if (phase === 'freeze' && phaseTimer <= 0) {
    phase = 'buy';
    phaseTimer = BUY_TIME;
    toggleBuyMenu(phase, player, round);
  }
  if (phase === 'buy' && phaseTimer <= 0) {
    phase = 'live';
    closeBuyMenu();
  }

  if (phase === 'live') {
    roundTimer -= dt / 1000;
    if (roundTimer <= 0 && !bomb.planted) {
      endRound('CT');
      return;
    }
    if (teamAlive('T') === 0 && !bomb.planted) {
      endRound('CT');
      return;
    }
    if (teamAlive('CT') === 0 && !bomb.planted) {
      endRound('T');
      return;
    }
  }

  if (phase === 'roundEnd') {
    if (phaseTimer <= 0) {
      round++;
      if (!gameOver) startRound();
    }
    return;
  }

  // Player movement
  if (player.alive && phase !== 'freeze') {
    const { mx, my } = getMoveInput();
    const isMoving = Math.abs(mx) > 0.1 || Math.abs(my) > 0.1;

    if (!isBuyMenuOpen()) {
      const weaponSpeed = playerWep().speed || 1.0;
      player.x += mx * PLAYER_SPEED * weaponSpeed;
      player.y += my * PLAYER_SPEED * weaponSpeed;
    }

    const col = collideCircleWalls(player.x, player.y, player.r);
    player.x = col.x;
    player.y = col.y;

    // Bomb planting
    const site = inBombsite(player.x, player.y);
    const canPlant = bomb.carrier === 'player' && site && !bomb.planted && phase === 'live';

    if (canPlant) {
      showBombAction();
      if (isBombActionPressed()) {
        if (!isMoving || isBombActionPressed()) {
          bomb.planting = true;
          bomb.planterRef = 'player';
          bomb.plantProgress += dt / 1000;
          document.getElementById('bomb-bar').style.width = (bomb.plantProgress / PLANT_TIME * 100) + '%';

          if (bomb.plantProgress >= PLANT_TIME) {
            bomb.planted = true;
            bomb.planting = false;
            bomb.carrier = null;
            bomb.x = player.x;
            bomb.y = player.y;
            bomb.site = site;
            bomb.detonateTimer = BOMB_TIMER;
            bomb.plantProgress = 0;
            hideBombAction();
          }
        }
      } else {
        bomb.planting = false;
        bomb.plantProgress = 0;
        document.getElementById('bomb-bar').style.width = '0%';
      }
    } else {
      hideBombAction();
      bomb.planting = false;
      bomb.plantProgress = 0;
    }

    // Auto-fire and shooting
    if (!isBuyMenuOpen() && !bomb.planting) {
      let autoT = null;
      let autoD = 320;

      for (const b of ctBots) {
        if (!b.alive) continue;
        const d = Math.sqrt((b.x - player.x) ** 2 + (b.y - player.y) ** 2);
        if (d < autoD && canSee(player.x, player.y, b.x, b.y)) {
          const a = Math.atan2(b.y - player.y, b.x - player.x);
          let diff = a - player.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) < 0.4) {
            autoT = b;
            autoD = d;
          }
        }
      }

      const shouldShoot = !!autoT || shooting;
      if (autoT) {
        const ta = Math.atan2(autoT.y - player.y, autoT.x - player.x);
        let diff = ta - player.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        player.angle += diff * 0.1;
      }

      if (shouldShoot && player.ammo > 0 && !player.reloading) {
        shootBullet(player, true);
      } else if (shouldShoot && player.ammo <= 0) {
        reload();
      }
    }

    // Reload
    const pw = playerWep();
    if (player.reloading && now - player.reloadStart > pw.reload) {
      const needed = pw.clip - player.ammo;
      const avail = Math.min(needed, player.reserve);
      player.ammo += avail;
      player.reserve -= avail;
      player.reloading = false;
    }
    if (isReloading()) reload();

    // Weapon switching
    const weaponSlot = getWeaponSwitch();
    if (weaponSlot > 0) {
      switchWeapon(weaponSlot);
    }
  }

  // Bomb carrier fallback
  if (bomb.carrier === 'player' && !player.alive && !bomb.planted) {
    bomb.dropped = true;
    bomb.dropX = player.x;
    bomb.dropY = player.y;
    bomb.carrier = null;
    let nearT = null;
    let nearD = Infinity;
    for (const b of tBots) {
      if (!b.alive) continue;
      const d = Math.sqrt((b.x - bomb.dropX) ** 2 + (b.y - bomb.dropY) ** 2);
      if (d < nearD) {
        nearT = b;
        nearD = d;
      }
    }
    if (nearT) bomb.carrier = nearT;
  }

  // Bot planting
  if (bomb.carrier && bomb.carrier !== 'player' && bomb.carrier.alive && !bomb.planted && phase === 'live') {
    const bot = bomb.carrier;
    const site = inBombsite(bot.x, bot.y);
    if (site) {
      bomb.planting = true;
      bomb.planterRef = bot;
      bomb.plantProgress += dt / 1000;
      if (bomb.plantProgress >= PLANT_TIME) {
        bomb.planted = true;
        bomb.planting = false;
        bomb.carrier = null;
        bomb.x = bot.x;
        bomb.y = bot.y;
        bomb.site = site;
        bomb.detonateTimer = BOMB_TIMER;
        bomb.plantProgress = 0;
      }
    } else {
      const dA = Math.sqrt((BOMBSITE_A.x - bot.x) ** 2 + (BOMBSITE_A.y - bot.y) ** 2);
      const dB = Math.sqrt((BOMBSITE_B.x - bot.x) ** 2 + (BOMBSITE_B.y - bot.y) ** 2);
      const target = dA < dB ? BOMBSITE_A : BOMBSITE_B;
      bot.targetX = target.x;
      bot.targetY = target.y;
    }
  }

  // Update bots
  for (const b of allBots()) updateBot(b, dt);

  // Update death fade for all dead entities
  if (!player.alive && player.deathAlpha > 0) {
    player.deathAlpha = Math.max(0, player.deathAlpha - dt / 1500); // Fade over 1.5 seconds
  }
  for (const b of allBots()) {
    if (!b.alive && b.deathAlpha > 0) {
      b.deathAlpha = Math.max(0, b.deathAlpha - dt / 1500);
    }
  }

  // Bomb detonation
  if (bomb.planted && !bomb.exploded && !bomb.defused) {
    bomb.detonateTimer -= dt / 1000;
    if (bomb.detonateTimer <= 0) {
      bomb.exploded = true;
      addExplosion(bomb.x, bomb.y);
      const blR = 150;
      for (const b of allBots()) {
        if (!b.alive) continue;
        if (Math.sqrt((b.x - bomb.x) ** 2 + (b.y - bomb.y) ** 2) < blR) {
          b.hp = 0;
          b.alive = false;
        }
      }
      if (player.alive && Math.sqrt((player.x - bomb.x) ** 2 + (player.y - bomb.y) ** 2) < blR) {
        player.hp = 0;
        player.alive = false;
        const aliveTeammates = tBots.filter(b => b.alive);
        if (aliveTeammates.length > 0) {
          setSpectateTarget(aliveTeammates[0]);
        } else {
          enableFreeCam(player.x, player.y);
        }
      }
      endRound('T');
      return;
    }
  }

  // Bomb defusing
  if (bomb.defusing && bomb.defuserRef && bomb.defuserRef.alive) {
    bomb.defuseProgress += dt / 1000;
    if (bomb.defuseProgress >= DEFUSE_TIME) {
      bomb.defused = true;
      bomb.defusing = false;
      endRound('CT');
      return;
    }
  } else {
    bomb.defusing = false;
    bomb.defuseProgress = 0;
    bomb.defuserRef = null;
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    let hitW = false;
    for (const w of walls) {
      if (rectContains(w, b.x, b.y)) {
        hitW = true;
        break;
      }
    }
    if (hitW || b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    // Hit player
    if (b.team === 'CT' && player.alive) {
      if (Math.sqrt((b.x - player.x) ** 2 + (b.y - player.y) ** 2) < player.r + 2) {
        let damage = b.dmg;
        // Apply kevlar protection
        if (player.hasKevlar) {
          damage *= (1 - KEVLAR_PROTECTION);
        }
        player.hp -= damage;
        addBlood(player.x, player.y);
        addScreenShake(damage * 0.15); // Shake intensity based on damage
        bullets.splice(i, 1);
        if (player.hp <= 0) {
          player.alive = false;
          player.deaths++;
          // Start spectating first alive teammate
          const aliveTeammates = tBots.filter(b => b.alive);
          if (aliveTeammates.length > 0) {
            setSpectateTarget(aliveTeammates[0]);
          } else {
            enableFreeCam(player.x, player.y);
          }
          addKill('CT', 'You', 'CT');
        }
        continue;
      }
    }

    // Hit bots
    const targets = b.team === 'T' ? ctBots : tBots;
    let hitB = false;
    for (const bot of targets) {
      if (!bot.alive) continue;
      if (Math.sqrt((b.x - bot.x) ** 2 + (b.y - bot.y) ** 2) < bot.r + 2) {
        bot.hp -= b.dmg;
        addBlood(bot.x, bot.y);
        hitB = true;
        if (bot.hp <= 0) {
          bot.alive = false;
          if (b.isPlayer) {
            player.kills++;
            player.money = Math.min(MAX_MONEY, player.money + KILL_REWARD);
            addKill('You', 'CT ' + (bot.id + 1), 'T');
          } else if (b.team === 'T') {
            addKill('T', 'CT ' + (bot.id + 1), 'T');
          } else {
            addKill('CT', 'T', 'CT');
          }
          if (bomb.defuserRef === bot) {
            bomb.defusing = false;
            bomb.defuserRef = null;
            bomb.defuseProgress = 0;
          }
        }
        break;
      }
    }
    if (hitB) {
      bullets.splice(i, 1);
      continue;
    }
  }

  // Update particles
  updateParticles(dt);

  // Update kill feed
  updateKillFeed(dt);

  // Update screen shake
  updateScreenShake(dt);

  // Spectate mode - cycle through teammates when dead
  if (!player.alive && keys[' ']) {
    keys[' '] = false; // Consume the key press
    const aliveTeammates = tBots.filter(b => b.alive);
    if (aliveTeammates.length > 0) {
      const currentTarget = getSpectateTarget();
      let currentIndex = -1;
      if (currentTarget) {
        currentIndex = aliveTeammates.findIndex(b => b === currentTarget);
      }
      const nextIndex = (currentIndex + 1) % aliveTeammates.length;
      setSpectateTarget(aliveTeammates[nextIndex]);
    }
  }

  // Reset spectate on respawn
  if (player.alive) {
    setSpectateTarget(null);
  }

  // Update visibility
  visUpdateTimer -= dt;
  if (visUpdateTimer <= 0) {
    updateVisibility();
    visUpdateTimer = 50;
  }

  // Update HUD
  updateHUD(player, phase, phaseTimer, roundTimer, round, tRounds, ctRounds, bomb);
}

function loop() {
  update();
  render(player, tBots, ctBots, bullets, bomb, visPolygon);
  requestAnimationFrame(loop);
}

// Initialize and start
export function startGame() {
  initVisibility();
  initRender((x, y) => jumpCameraTo(x, y));
  initInput(document.getElementById('game'), player, isBuyMenuOpen, () => toggleBuyMenu(phase, player, round));
  initBombActionInput(document.getElementById('bomb-action'));
  initBuyMenuListeners(player);
  initCenterMessageListeners(restartGame);
  initBots();
  startRound();
  loop();
}
