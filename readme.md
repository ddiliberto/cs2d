# CS2D

A browser-based, mobile-first top-down Counter-Strike clone. Portrait orientation. Touch controls. Built entirely in vanilla HTML/JS/Canvas.

**Play it:** [https://ddiliberto.github.io/cs2d/](https://ddiliberto.github.io/cs2d/)

## What It Is

A tactical top-down shooter inspired by CS 1.6, built for mobile browsers. You play as T side in 5v5 matches on a simplified de_dust layout with full round economy, bomb plant/defuse mechanics, and Foxhole-style fog of war.

## Features

- **Top-down tactical gameplay** on a de_dust-inspired map
- **Touch controls** — left joystick to move, right swipe to aim, auto-fire on enemies
- **Fog of war** — 2D raycasted shadow casting with shared team vision
- **Round system** — freeze time, buy phase, live round, first to 13
- **Economy** — earn money from kills and round wins, buy weapons between rounds
- **Bomb plant/defuse** — full T-side bomb loop with bot carrier fallback
- **Bot AI** — patrol, engage, search states with line-of-sight detection
- **Weapons** — Glock, MP5, AK-47, AWP with unique stats

## Controls

| Input | Action |
|-------|--------|
| Left side drag | Move (virtual joystick) |
| Right side swipe | Aim / rotate |
| Auto | Fires when crosshair is near a visible enemy |
| Bomb button | Hold to plant when on bombsite |
| B key (desktop) | Open buy menu |
| R key (desktop) | Reload |
| WASD (desktop) | Move |
| Mouse (desktop) | Aim + click to shoot |

## Tech

- Single `index.html` file, zero dependencies
- Vanilla Canvas 2D rendering
- 2D raycasting visibility system
- Touch API for mobile input
- Runs at 60fps on modern mobile browsers

## Development

See [CLAUDE.md](./CLAUDE.md) for the full development plan, architecture notes, and implementation checklist.

## License

MIT
