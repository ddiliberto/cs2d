# CLAUDE.md — CS2D Development Brief

## Project Overview

CS2D is a browser-based, mobile-first top-down Counter-Strike clone. Vanilla JS + Canvas 2D for the game engine. Portrait orientation for mobile. 5v5 competitive multiplayer with public lobbies. The goal is a polished tactical shooter that captures the core CS loop in a 2D top-down format.

**Target platform:** Mobile browsers (iOS Safari, Chrome Android), desktop as secondary.
**Inspiration:** Counter-Strike 1.6 gameplay, Foxhole/Teleglitch fog of war, Hotline Miami aesthetic.
**Multiplayer model:** Server-authoritative, WebSocket-based, 5v5 with public matchmaking.

---

## Architecture

### Project Structure

```
cs2d/
├── client/
│   ├── index.html              # Entry point, loads shell + game
│   ├── shell/                  # React — lobby, menus, matchmaking UI
│   │   ├── App.jsx
│   │   ├── Lobby.jsx           # Public lobby browser
│   │   ├── RoomCreate.jsx      # Create match settings
│   │   ├── RoomWaiting.jsx     # Pre-match waiting room
│   │   ├── Scoreboard.jsx      # End-of-match stats
│   │   ├── Settings.jsx        # Sensitivity, volume, controls
│   │   ├── PlayerCard.jsx      # Player name, avatar, stats
│   │   └── Auth.jsx            # Guest name or account login
│   ├── game/                   # Vanilla JS — the real-time game engine
│   │   ├── main.js             # Game loop, init, state management
│   │   ├── render.js           # All canvas drawing, fog compositing
│   │   ├── input.js            # Touch + keyboard/mouse handlers
│   │   ├── visibility.js       # Raycasting, visibility polygon, fog
│   │   ├── hud.js              # DOM-based HUD, buy menu, kill feed
│   │   ├── particles.js        # Blood, explosions, shell casings
│   │   ├── audio.js            # Sound effects, spatial audio
│   │   └── camera.js           # Camera follow, spectate mode
│   └── net/                    # Client networking layer
│       ├── socket.js           # WebSocket connection management
│       ├── prediction.js       # Client-side prediction + reconciliation
│       ├── interpolation.js    # Entity interpolation between server ticks
│       └── protocol.js         # Message serialization (mirrors server)
├── server/
│   ├── index.js                # Entry point, HTTP + WebSocket server
│   ├── lobby.js                # Public lobby management, room listing
│   ├── room.js                 # Individual match room lifecycle
│   ├── game-loop.js            # Server-authoritative game tick
│   ├── player.js               # Server-side player state
│   ├── bot-backfill.js         # Fill empty slots with bots
│   ├── physics.js              # Movement + collision (uses shared)
│   ├── combat.js               # Hit detection, damage, kills
│   ├── bomb.js                 # Plant/defuse/detonation server logic
│   ├── economy.js              # Money management, buy validation
│   ├── round.js                # Round state machine, phase transitions
│   ├── anti-cheat.js           # Input validation, rate limiting
│   └── protocol.js             # Message definitions (mirrors client)
├── shared/                     # Isomorphic code — runs on both sides
│   ├── config.js               # All game constants, timing, limits
│   ├── weapons.js              # Weapon stats, fire rates, damage values
│   ├── map-data.js             # Wall arrays, spawns, bombsites
│   ├── collision.js            # Circle-AABB, line-AABB, line-of-sight
│   └── protocol-types.js       # Message type enums, payload shapes
├── package.json
├── README.md
└── CLAUDE.md
```

### Two-Layer Architecture

**Layer 1: Game Engine (vanilla JS + Canvas)**
Real-time gameplay. Rendering, input, physics, visibility, particles. No framework. Runs the canvas render loop at 60fps. In multiplayer, receives server state and interpolates. Sends player inputs to server.

**Layer 2: Shell (React)**
Everything outside the match. Lobby browser, room creation, waiting room, settings, scoreboard, auth. Standard web app. Mounts/unmounts the game canvas when entering/leaving a match.

These layers communicate through a simple interface:
- Shell calls `Game.start(config)` to launch a match
- Shell calls `Game.destroy()` to tear down
- Game emits events back to shell (match ended, player disconnected)

---

## Multiplayer Architecture

### Server Authority Model
- Server owns the game state. It runs the physics, hit detection, economy, and round logic.
- Client sends inputs only: `{tick, moveX, moveY, angle, shooting, action}`.
- Server simulates, then broadcasts state snapshots to all clients.
- Client predicts locally for responsive feel, reconciles when server state arrives.

### Tick Rate + Networking
- Server tick: **20 ticks/sec** (50ms intervals). Sufficient for 5v5.
- Client render: **60fps**, interpolating between server snapshots.
- Protocol: Binary or JSON over WebSocket. JSON first for simplicity, optimize to binary later if needed.
- Bandwidth per client: ~2-5kb/sec for 10-player state updates at 20 ticks.

### Client-Side Prediction
- Player inputs are applied locally immediately (movement, shooting).
- Each input is tagged with a tick number.
- When server state arrives, client replays unacknowledged inputs on top of server state.
- Mismatch = correction. Small corrections are smoothed, large ones snap.

### Entity Interpolation
- Other players (non-local) are rendered with a ~100ms delay (2 server ticks behind).
- Client interpolates between the two most recent server positions for smooth movement.
- This is the standard CS/Overwatch/Valorant model.

### What the Server Sends
Each tick, per client:
- Positions + angles of all players visible to that client's team (server-side visibility culling)
- Bullet events (who shot, from where, hit/miss)
- Health changes, kills, round state
- Bomb status (carrier, planted position, timer, defuse progress)
- Economy updates only on round boundaries

### What the Server Does NOT Send
- Enemy positions outside team line-of-sight (anti-wallhack by design)
- Raw visibility polygons (client computes its own fog from known positions)

### Visibility + Anti-Cheat
- Server runs line-of-sight checks to determine which enemies each team can see.
- Only visible enemy data is sent to each client. Invisible enemies don't exist on the client.
- This means fog of war is enforced server-side, not just cosmetic.
- Client still computes its own visibility polygon for rendering fog, but can only render enemies the server has confirmed are visible.

---

## Lobby + Matchmaking

### Public Lobbies (v1)
- Simple room list. Players see available rooms with: map, player count, round status.
- "Create Room" with settings: map selection, max rounds (24 default).
- "Join Room" drops you into an available slot.
- Rooms auto-start when 10 players are present (or host can force-start with bots).

### Bot Backfill
- Empty slots are filled with server-side bots.
- Bots are replaced when a real player joins.
- If a player disconnects mid-match, a bot takes over their slot.
- Bot difficulty matches the average skill of the room (future: basic skill tracking).

### Room Lifecycle
```
WAITING → STARTING (countdown) → IN_PROGRESS → FINISHED → CLOSED
```
- WAITING: Players join, chat, ready up.
- STARTING: 10-second countdown, team assignment (random or pick).
- IN_PROGRESS: Active match with round system.
- FINISHED: Final scoreboard, MVP, stats. Room stays open for 30s.
- CLOSED: Room removed from lobby list.

### Player Identity (v1)
- Guest mode: pick a display name, get a session token. No account required.
- Session persists via cookie/localStorage for reconnection.
- Future: optional accounts for stats, rankings, cosmetics.

---

## Core Game Systems (Current State)

### Done
- [x] Top-down canvas renderer with camera follow
- [x] de_dust simplified map layout (T spawn, CT spawn, A/B sites, Long A, Mid, Tunnels)
- [x] Player movement with wall collision
- [x] Virtual joystick (touch) + WASD/mouse (desktop)
- [x] Swipe-to-aim on right side of screen
- [x] Auto-fire when crosshair is within cone of visible enemy
- [x] Aim assist (gentle snap toward target)
- [x] Bullet system with spread, damage, wall collision
- [x] Bot AI — patrol, engage, search states with LOS detection
- [x] 5v5 — 4 T bots + player vs 5 CT bots
- [x] Friendly T bots with team labels
- [x] Round system — freeze, buy, live, round end
- [x] Economy — kill reward ($300), round win ($3250), round loss ($1400), $16k cap
- [x] Buy menu — Glock, MP5, AK-47, AWP with unique stats
- [x] Bot economy + auto-buy logic
- [x] Bomb plant — player carries, hold to plant on bombsite (3.2s)
- [x] Bomb carrier fallback — drops to nearest T bot on death
- [x] T bot auto-plant when reaching bombsite
- [x] Bomb detonation timer (40s) with visual pulse
- [x] CT bot defuse (5s), path to bomb when no enemies visible
- [x] Round win conditions — elimination, detonation, defuse, timeout
- [x] Fog of war — 2D raycasted visibility polygon from wall edges
- [x] Shared team vision (player + T bot vision combined)
- [x] Radial gradient fog falloff
- [x] Enemies only render when visible to team
- [x] Minimap with fog-aware enemy dots
- [x] Kill feed, HUD, blood particles, explosion particles
- [x] Match system — first to 13, restart on match end

---

## Roadmap

### Phase 1 — Modularize (DO THIS FIRST) ✅ COMPLETE
- [x] Split `index.html` into ES module files per the structure above
- [x] Extract shared code: config, weapons, map-data, collision
- [x] Ensure game runs identically after split (no regressions)
- [x] Set up basic dev server (Vite or plain HTTP server with module support)

### Phase 2 — Gameplay Polish (Single Player) ✅ COMPLETE
- [x] Loss bonus economy escalation ($1400 → $1900 → $2400 → $2900 → $3400)
- [x] Half-time side swap at round 13
- [x] Kevlar + helmet in buy menu ($650/$1000, damage reduction)
- [x] Pistol round enforcement (rounds 1 and 13)
- [x] Movement speed varies by weapon (AWP slow, knife fast)
- [x] Weapon switch between primary and pistol (1/2/3 keys, includes knife)
- [x] Reload visual indicator on player
- [x] Muzzle flash on shoot
- [x] Death body fade-out (1.5 second fade)
- [x] Screen shake on damage
- [x] Spectate alive teammates on death (cycle with spacebar)
- [x] BONUS: Camera drag when dead (touch/mouse)
- [x] BONUS: Minimap click to jump camera
- [x] BONUS: Elegant fog of war gradient fading
- [x] BONUS: Spacebar to plant bomb

### Phase 3 — Audio
- [ ] Web Audio API setup with spatial positioning
- [ ] Per-weapon gunshot sounds
- [ ] Reload, footstep, bomb beep sounds
- [ ] Hit confirmation (dink for headshot area)
- [ ] Round start/end voice lines
- [ ] Ambient background loop
- [ ] Sound occlusion through walls (muffle distant sounds)

### Phase 4 — Server + Networking
- [ ] Node.js server with `ws` WebSocket library
- [ ] Server game loop at 20 ticks/sec
- [ ] Server-side physics using shared collision code
- [ ] Server-side hit detection + damage
- [ ] Server-side round + economy management
- [ ] Server-side bomb logic
- [ ] Server-side visibility culling (only send visible enemies)
- [ ] Client input sending (tick-stamped)
- [ ] Client-side prediction for local player movement
- [ ] Entity interpolation for remote players
- [ ] Reconciliation on server correction
- [ ] Handle player connect/disconnect gracefully

### Phase 5 — Lobby + Rooms
- [ ] Room creation with settings (map, max rounds)
- [ ] Public room browser (list of joinable rooms)
- [ ] Room waiting state with player list and ready system
- [ ] Team assignment (random or pick sides)
- [ ] Auto-start when full, host force-start option
- [ ] Bot backfill for empty slots
- [ ] Bot replacement when real player joins
- [ ] Player reconnection within a time window
- [ ] Post-match scoreboard with stats

### Phase 6 — React Shell
- [ ] Vite + React setup for shell layer
- [ ] Lobby browser component
- [ ] Room creation / settings UI
- [ ] Waiting room with player cards
- [ ] In-match HUD (can stay DOM-based, doesn't need React)
- [ ] Post-match stats screen
- [ ] Settings page (sensitivity, volume, controls)
- [ ] Guest identity (display name + session token)
- [ ] Shell ↔ Game interface (`Game.start()`, `Game.destroy()`, event emitter)

### Phase 7 — Map + Visual Polish
- [ ] Accurate de_dust geometry (reference original layout)
- [ ] Wall texture variation (wood, concrete, metal fills)
- [ ] Floor zone coloring (sand, concrete, tile)
- [ ] Map props (barrels, crates) as cover objects
- [ ] de_dust2 as second map
- [ ] Map selection in room creation
- [ ] Minimap improvements (better scaling, player direction indicators)

### Phase 8 — AI Improvements
- [ ] A* pathfinding or navigation mesh for bots
- [ ] Bot difficulty tiers (reaction time, accuracy, decision quality)
- [ ] Bot callout text ("Spotted A", "Rotating B")
- [ ] Coordinated bot strategies (site executes, retakes)
- [ ] Bots pick up dropped bomb from ground

### Phase 9 — Deployment + Distribution
- [ ] Server deployment (Railway, Fly.io, or VPS)
- [ ] Client on GitHub Pages or Vercel
- [ ] PWA manifest + service worker for "add to homescreen"
- [ ] Fullscreen mobile app experience
- [ ] Performance profiling on low-end devices
- [ ] WebSocket reconnection handling
- [ ] Basic analytics (match count, player count, session length)

### Future / Stretch
- [ ] Ranked matchmaking with ELO
- [ ] Player accounts + persistent stats
- [ ] Larger game modes (16v16, 32v32 with bigger maps)
- [ ] Grenade system (smoke, flash, HE, molotov)
- [ ] Cosmetic skins (player colors, weapon skins)
- [ ] Replay system
- [ ] Custom map editor
- [ ] Clan/team system

---

## Server Tech Stack

**Runtime:** Node.js (stable, huge ecosystem, easy WebSocket support)
**WebSocket:** `ws` library (lightweight, performant, no Socket.io overhead)
**Deployment:** Railway or Fly.io (easy WebSocket support, auto-scaling)
**Database (future):** SQLite for stats/accounts (simple, no infra), or Postgres if scaling

### Server Performance Budget (5v5)
- 10 players × 20 ticks/sec = 200 state broadcasts/sec
- Each broadcast ~200-500 bytes per client (positions, angles, health, actions)
- Total bandwidth: ~40-100kb/sec outbound per room
- CPU: single Node process can handle 50+ concurrent rooms at this scale
- Memory: ~1-2MB per active room

---

## Code Conventions

- Game engine: vanilla JS, ES modules, no framework
- Shell/lobby: React with Vite
- Shared code: plain JS modules importable by both client and server
- All world coordinates in "map units" (1 unit ≈ 1 pixel at default zoom)
- Walls: `[x, y, width, height]` arrays
- Entities: `{x, y, angle, r, hp, maxHp, alive, team, id, ...}`
- Bullets: `{x, y, vx, vy, team, playerId, life, dmg}`
- Messages: `{type: string, tick: number, data: object}`
- Naming: camelCase for variables/functions, PascalCase for React components, UPPER_SNAKE for constants

## Performance Notes

- Visibility raycasting is the most expensive client-side operation. Throttled to every 50ms.
- Teammate visibility uses 70% range to reduce ray count.
- Server does NOT compute full visibility polygons. It only checks line-of-sight per enemy pair.
- Fog compositing uses offscreen canvas with `destination-out` blending.
- Particle count self-limits via short lifetimes (30-40 frames).
- For 5v5, all systems are well within budget on modern mobile hardware.

---

## How to Run

### Single Player (current)
```bash
open index.html
# or
python3 -m http.server 8000
```

### Multiplayer (future)
```bash
# Server
cd server && npm install && node index.js

# Client
cd client && npm run dev
```

### Deploy
```bash
# Client: push to GitHub Pages or Vercel
# Server: deploy to Railway or Fly.io
```