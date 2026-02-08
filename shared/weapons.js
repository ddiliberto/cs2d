// Weapon stats, fire rates, damage values

export const WEAPONS = {
  knife: { name: 'Knife', cost: 0, dmg: 40, rate: 500, clip: 999, reserve: 0, spread: 0, reload: 0, speed: 1.15 },
  glock: { name: 'Glock', cost: 0, dmg: 18, rate: 200, clip: 20, reserve: 40, spread: 0.08, reload: 2200, speed: 1.0 },
  usp: { name: 'USP', cost: 0, dmg: 22, rate: 250, clip: 12, reserve: 24, spread: 0.05, reload: 2200, speed: 1.0 },
  mp5: { name: 'MP5', cost: 1500, dmg: 20, rate: 120, clip: 30, reserve: 90, spread: 0.09, reload: 2400, speed: 0.98 },
  ak47: { name: 'AK-47', cost: 2700, dmg: 28, rate: 140, clip: 30, reserve: 90, spread: 0.06, reload: 2500, speed: 0.95 },
  m4a1: { name: 'M4A1', cost: 3100, dmg: 25, rate: 130, clip: 30, reserve: 90, spread: 0.04, reload: 2500, speed: 0.95 },
  awp: { name: 'AWP', cost: 4750, dmg: 100, rate: 1200, clip: 5, reserve: 20, spread: 0.01, reload: 3500, speed: 0.8 },
};

export const T_BUY = ['glock', 'mp5', 'ak47', 'awp'];
export const CT_BUY = ['usp', 'mp5', 'm4a1', 'awp'];
