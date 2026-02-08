// Blood, explosions, shell casings

export const particles = [];

export function addBlood(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      life: 30,
      color: `rgb(${150 + Math.random() * 100 | 0},0,0)`,
      r: 2 + Math.random() * 2,
    });
  }
}

export function addExplosion(x, y) {
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 5;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 40 + Math.random() * 20,
      color: Math.random() > 0.5 ? '#f90' : '#f44',
      r: 3 + Math.random() * 4,
    });
  }
}

export function addMuzzleFlash(x, y, angle) {
  // Brief yellow/orange flash at barrel
  const flashX = x + Math.cos(angle) * 12;
  const flashY = y + Math.sin(angle) * 12;

  particles.push({
    x: flashX,
    y: flashY,
    vx: 0,
    vy: 0,
    life: 3, // Very brief
    color: '#ffee66',
    r: 6 + Math.random() * 3,
  });

  // Add a couple of small sparks
  for (let i = 0; i < 2; i++) {
    const sparkAngle = angle + (Math.random() - 0.5) * 0.3;
    particles.push({
      x: flashX,
      y: flashY,
      vx: Math.cos(sparkAngle) * 2,
      vy: Math.sin(sparkAngle) * 2,
      life: 5 + Math.random() * 3,
      color: Math.random() > 0.5 ? '#ff9933' : '#ffee66',
      r: 1.5,
    });
  }
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.vx *= 0.94;
    p.vy *= 0.94;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
