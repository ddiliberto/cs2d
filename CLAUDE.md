# CLAUDE.md — CS2D Development Brief

## Project Overview

CS2D is a browser-based, mobile-first top-down Counter-Strike clone. Single HTML file. Vanilla JS + Canvas 2D. Portrait orientation for mobile. The goal is a playable, polished tactical shooter that captures the core CS loop in a 2D format.

**Target platform:** Mobile browsers (iOS Safari, Chrome Android), desktop as secondary.
**Inspiration:** Counter-Strike 1.6 gameplay, Foxhole/Teleglitch fog of war, Hotline Miami feel.

---

## Architecture

### Single File Structure
Everything lives in `index.html`. If the project grows, consider splitting into modules, but for now the single-file approach keeps deployment simple (GitHub Pages, any static host).

### Core Systems
- **Rendering:** Canvas 2D with camera follow. Offscreen canvas for fog compositing.
- **Map:** Array of rectangle wall definitions `[x, y, w, h]`. All collision and raycasting runs against these.
- **Collision:** Circle-vs-AABB for player/bot movement. Line-vs-AABB for bullet hits and line-of-sight.
- **Visibility:** 2D raycasting from player position to all wall corner points. Produces a visibility polygon. Fog of war rendered via offscreen canvas with `destination-out` compositing and radial gradient falloff.
- **Input:** Dual-touch system. Left side = virtual joystick (move). Right side = swipe to aim. Auto-fire triggers when crosshair cone overlaps a visible enemy.
- **AI:** State machine per bot (patrol, search, engage). Line-of-sight detection. CT bots path toward planted bomb to defuse.
- **Economy:** Per-entity money. Earned from round wins/losses and kills. Spent during buy phase.
- **Round system:** Freeze > Buy > Live > Round End. First to 13 wins.

### Key Constants
```
MAP_W: 1400, MAP_H: 1000
VIS_RANGE: 450
ROUND_TIME: 115s
BUY_TIME: 15s
FREEZE_TIME: 5s
PLANT_TIME: 3.2s
DEFUSE_TIME: 5s
BOMB_TIMER: 40s
MAX_ROUNDS: 24
```

---

## What's Been Built (v1)

### Done
- [x] Top-down canvas renderer with camera follow
- [x] de_dust simplified map layout (T spawn, CT spawn, A site, B site, Long A, Mid, Tunnels)
- [x] Player movement with wall collision
- [x] Virtual joystick (touch) + WASD/mouse (desktop)
- [x] Swipe-to-aim on right side of screen
- [x] Auto-fire when crosshair is within cone of visible enemy
- [x] Aim assist (gentle lock toward target)
- [x] Bullet system with spread, damage, wall collision
- [x] Bot AI — patrol, engage, search states
- [x] 5v5 — 4 T bots + player vs 5 CT bots
- [x] Friendly T bots with team labels
- [x] Round system — freeze, buy, live, round end
- [x] Economy — money for kills ($300), round win ($3250), round loss ($1400), $16k cap
- [x] Buy menu — Glock, MP5, AK-47, AWP with unique stats
- [x] Bot economy + auto-buy logic
- [x] Bomb plant — player carries bomb, hold to plant on bombsite
- [x] Bomb carrier fallback — drops to nearest T bot on player death
- [x] T bot auto-plant when reaching bombsite
- [x] Bomb detonation timer (40s) with visual pulse
- [x] CT bot defuse behavior — path to bomb, 5s defuse
- [x] Round win conditions — elimination, detonation, defuse, timeout
- [x] Fog of war — 2D raycasted visibility polygon
- [x] Shadow casting from wall edges
- [x] Shared team vision (player + T bot vision combined)
- [x] Radial gradient fog falloff
- [x] Enemies only render when visible to team
- [x] Minimap with fog-aware enemy dots
- [x] Kill feed (color coded by team)
- [x] HUD — health, money, ammo, round info, bomb status
- [x] Blood particles on hit
- [x] Explosion particles on bomb detonation
- [x] Match system — first to 13, restart on match end

---

## Roadmap

### Phase 2 — Gameplay Polish
- [ ] **Weapon buy menu expansion** — add kevlar/helmet ($650/$1000), defuse kit for CT
- [ ] **Pistol round logic** — round 1 and round 13 (half) force pistol only
- [ ] **Loss bonus economy** — escalating loss bonus ($1400, $1900, $2400, $2900, $3400)
- [ ] **Half-time side swap** — switch T/CT at round 13
- [ ] **Reload animation** — visual indicator on player during reload
- [ ] **Weapon switch delay** — slight delay when buying/switching weapons
- [ ] **Headshot system** — bonus damage for shots hitting front-facing angle
- [ ] **Movement speed by weapon** — AWP slows you down, knife speeds you up
- [ ] **Knife/secondary weapon** — quick switch between primary and pistol

### Phase 3 — Map & Level Design
- [ ] **Accurate de_dust layout** — reference original map for tighter geometry
- [ ] **Wall texture variation** — different fills for different materials (wood, concrete, metal)
- [ ] **Floor zones** — visual distinction between areas (sand, concrete, tiles)
- [ ] **Spawn zone visuals** — marked spawn areas
- [ ] **Map props** — barrels, crates, vehicles as cover (non-wall decorative collision)
- [ ] **Second map** — de_dust2 layout
- [ ] **Map selection screen**

### Phase 4 — AI Improvements
- [ ] **Pathfinding** — A* or navmesh so bots don't walk into walls
- [ ] **Bot difficulty levels** — reaction time, accuracy, decision-making variance
- [ ] **Bot callouts** — basic text indicators ("Enemy spotted A", "Rotating B")
- [ ] **Bot strategy** — coordinated site takes, retakes, rotations
- [ ] **Bot grenade usage** — if grenades are added
- [ ] **Bots pick up dropped bomb** — any T bot walks to dropped bomb location

### Phase 5 — Audio & Feedback
- [ ] **Gunshot sounds** — unique per weapon (Web Audio API or preloaded Audio elements)
- [ ] **Reload sound**
- [ ] **Footstep sounds** — audible when moving, louder when running
- [ ] **Bomb plant/defuse audio** — beeping, countdown urgency
- [ ] **Hit confirmation sound** — dink for headshot
- [ ] **Round start/end audio** — "Terrorists win" / "Counter-terrorists win"
- [ ] **Ambient background** — subtle wind/environment loop
- [ ] **Muzzle flash** — brief visual flash on shoot
- [ ] **Shell casings** — small particle ejection on fire
- [ ] **Death animation** — brief body fade-out instead of instant disappear
- [ ] **Screen shake** — subtle on taking damage

### Phase 6 — UI/UX
- [ ] **Start screen** — title, play button, settings
- [ ] **Settings menu** — sensitivity, sound volume, auto-fire toggle
- [ ] **Scoreboard** — tab/tap to view full scoreboard with K/D/A and economy
- [ ] **Round history** — visual bar showing round wins like CS2 HUD
- [ ] **Kill reward popup** — "+$300" floating text on kill
- [ ] **Damage numbers** — optional floating damage on hit
- [ ] **Spectate on death** — cycle through alive teammates when dead
- [ ] **Touch control customization** — adjustable joystick size/position
- [ ] **Tutorial/onboarding** — first-time player guide overlay

### Phase 7 — Multiplayer (Stretch)
- [ ] **WebSocket server** — Node.js or Deno for real-time sync
- [ ] **Room/lobby system** — create/join matches
- [ ] **Player interpolation** — smooth movement between server updates
- [ ] **Server-authoritative hit detection** — prevent cheating
- [ ] **Chat system** — quick chat commands
- [ ] **Matchmaking** — basic ELO or casual queue

### Phase 8 — Distribution
- [ ] **PWA support** — manifest.json, service worker for offline play
- [ ] **Add to homescreen** — fullscreen mobile app experience
- [ ] **Performance profiling** — optimize for low-end devices
- [ ] **Bundle size** — keep under 100kb if possible
- [ ] **Analytics** — basic play session tracking
- [ ] **Social sharing** — share match results

---

## Code Conventions

- Single file for now. If splitting: `/src/game.js`, `/src/map.js`, `/src/ai.js`, `/src/input.js`, `/src/render.js`, `/src/visibility.js`
- All world coordinates are in "map units" (roughly 1 unit = 1 pixel at scale 1)
- Walls are always `[x, y, width, height]` arrays
- Bot objects share a common shape: `{x, y, angle, r, hp, maxHp, alive, team, id, state, ...}`
- Player object has the same base shape plus weapon/ammo/economy fields
- Bullets: `{x, y, vx, vy, team, isPlayer, life, dmg}`
- Visibility polygon: array of `{x, y, a}` sorted by angle

## Performance Notes

- Visibility raycasting is the most expensive operation. Currently throttled to every 50ms.
- Teammate visibility polygons use 70% range to reduce ray count.
- If performance drops, reduce `wallPoints` by merging colinear edges or limiting ray count.
- Fog compositing uses an offscreen canvas to avoid blending artifacts.
- Particle count is capped implicitly by short lifetimes (30-40 frames).

---

## How to Run

```bash
# Local
open index.html
# or
python3 -m http.server 8000

# Deploy
# Push to GitHub, enable Pages on main branch root
```

## Repo Structure
```
cs2d/
├── index.html    # The entire game
├── README.md     # Project overview
└── CLAUDE.md     # This file — dev brief + roadmap
```