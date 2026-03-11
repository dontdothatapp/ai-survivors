# AI SURVIVORS — Project Overview

A multiplayer Vampire Survivors parody. Up to 8 players share one screen (laptop/TV) and control their characters from their phones via a virtual joystick over local WiFi. Theme: software engineers fighting feature requests, bugs, managers, and ultimately AI itself.

---

## Tech Stack

- **Runtime**: Node.js (ESM, `"type": "module"`)
- **Server deps**: `ws` only — no framework
- **Frontend**: Vanilla HTML5 Canvas + ES Modules, no build step
- **Start**: `npm start` → `node server.js`

---

## Architecture

```
AI_survivors/
├── server.js              # HTTP static server + WebSocket relay (~120 lines)
└── public/
    ├── game.html           # Game screen (laptop/TV)
    ├── controller.html     # Phone controller
    ├── css/
    │   ├── game.css
    │   └── controller.css
    └── js/
        ├── game/
        │   ├── main.js     # Game loop, orchestration, lobby/game-over flow
        │   ├── renderer.js # All canvas drawing, camera, screen shake, floating text
        │   ├── entities.js # Player, Enemy, Projectile, XPGem classes
        │   ├── waves.js    # WaveManager — enemy spawning & progression
        │   ├── weapons.js  # WEAPON_DEFS + updateWeapons()
        │   ├── upgrades.js # Upgrade pool + rollUpgrades() / applyUpgrade()
        │   ├── sprites.js  # Programmatic pixel art (offscreen canvas cache)
        │   ├── sound.js    # Web Audio API oscillator-based retro beeps
        │   └── network.js  # Game-screen WebSocket client + broadcast helpers
        └── controller/
            ├── controller.js  # Phone WS connection, state display, upgrade UI
            └── joystick.js    # Touch/mouse joystick (~80 lines)
```

### Server (`server.js`)
- Dumb relay — no game state server-side
- HTTP: serves `public/` as static files with MIME types
- WebSocket routes:
  - `/game` → game screen (one connection)
  - `/controller` → phone controllers (up to 8)
- Assigns player IDs (0–7), forwards input to game screen, state back to phones
- Detects local IP and prints game + controller URLs on start

### Game Screen
- All game logic runs in the browser
- `main.js` owns the game loop (`requestAnimationFrame`), imports all modules
- Camera tracks centroid of alive players (smooth lerp)
- Keyboard fallback: press **Space** to add debug player, **WASD/arrows** to move, **Enter** to start

### Phone Controller
- Connects to `/controller`, receives assigned player ID
- Touch joystick sends `{type:"input", dx, dy}` at ~30 Hz
- Displays HP bar, XP bar, level
- On level-up: joystick replaced by 3 tappable upgrade buttons
- Screen wake lock via `navigator.wakeLock`

---

## Networking Protocol

| Direction | Message | Notes |
|-----------|---------|-------|
| Phone → Game | `{type:"input", playerId, dx, dy}` | 30 Hz |
| Game → All phones | `{type:"state", players:[...]}` | 5 Hz |
| Game → Specific phone | `{type:"upgrade_prompt", targetPlayer, options}` | on level-up |
| Phone → Game | `{type:"upgrade_pick", upgradeId}` | upgrade selection |
| Phone → Game | `{type:"request_start"}` | start from phone |
| Game → All phones | `{type:"game_start"}` / `{type:"game_over", victory, stats}` | flow events |
| Server → Game | `{type:"player_joined/left", playerId}` | connection events |

---

## Game Loop (`main.js`)

Each frame:
1. **Pause check** — if any player has `pendingUpgrade`, skip simulation, render with pause overlay
2. Player `update(dt)` — apply joystick input, move, update duck orbit angle
3. Soft player-player collision (push apart)
4. Coffee aura boost (temporarily bumps `fireRateMultiplier`)
5. `updateWeapons(dt, player, projectiles, enemies)` for each player
6. Rubber duck contact damage check
7. Enemy update — frozen timer, then type-specific AI
8. Projectile update + enemy collision detection
9. Enemy-player contact damage
10. XP gem magnet + collection → level-up trigger
11. `WaveManager.update()` — timer, spawn new enemies
12. Cleanup dead entities
13. Game-over check (all dead / boss defeated)
14. Camera update + render
15. Broadcast state to phones (5 Hz)

---

## Entities

### Player
- `id`, `color`, `name`, `x/y`, `dx/dy` (joystick input), `facingX/Y`
- Stats: `speed=150`, `radius=14`, `hp/maxHp=100`, `pickupRadius=50`
- Multipliers: `damageMultiplier`, `fireRateMultiplier`, `aoeMultiplier`
- `bonusPierce` — added to all projectile pierce values
- `projectileCount` — number of projectiles fired per shot (1 by default); extras are fanned out at ±0.25 rad intervals around the facing direction
- `weapons[]` — array of `{type, cooldown}` objects
- `pendingUpgrade` — true while waiting for upgrade pick (pauses game)
- `invincibleTimer` — brief i-frames after taking damage (0.3s)

### Enemy Types

| Type | HP | Speed | Notes |
|------|----|-------|-------|
| `jira` | 15 | 60 | Basic walker |
| `bug` | 10 | 110 | Zigzag movement |
| `feature` | 40 | 40 | Splits into 2 JIRAs on death |
| `merge` | 80 | 30 | Tanky |
| `flaky` | 12 | 50 | Teleports every 2s |
| `pm` | 150 | 35 | Elite — spawns JIRA tickets every 4s |
| `em` | 200 | 30 | Elite — pulls players every 5s |
| `vp` | 300 | 25 | Elite — shuffles player positions + spawns minions |
| `boss` | 2000+ | 20 | 3 phases (see below) |

### Boss — THE AI (wave 20)
- **Phase 1** (>66% HP): spawns enemy clusters every 4s
- **Phase 2** (33–66%): hallucination — spawns 4 flaky enemies every 1.5s
- **Phase 3** (<33%): rearranges player positions, spawns bugs every 2s, speed bumps to 35

### Projectile
- `vx/vy`, `damage`, `pierce` (decrements per hit), `hitEnemies` Set
- `isAOE` flag — AOE projectiles check radius instead of point collision
- `homing` flag — hotfix projectiles steer toward nearest enemy

### XPGem
- Magnets toward nearest player within `pickupRadius`
- Collected on overlap

---

## Weapons

All defined in `WEAPON_DEFS` in `weapons.js`. Each has `cooldown`, `damage`, `speed`, `pierce`, and a `fire(player, projectiles, enemies)` method.

| Weapon | Cooldown | Behavior |
|--------|----------|----------|
| `code_review` | 0.5s | Fires in facing direction, pierces 1 |
| `stackoverflow` | 1.2s | 4 cardinal direction projectiles |
| `git_revert` | 3s | AOE pulse (radius 80), hits all in range |
| `rubber_duck` | passive | Orbits player at r=50, contact damage (0.5s cooldown per enemy; shows hit sound + floating text) |
| `unit_test` | 0.15s | Fast forward volley with slight spread |
| `hotfix` | 2s | Slow homing projectile, high damage |
| `coffee` | passive | Aura — +30% fire rate to nearby allies |
| `standup` | 8s | Freezes all enemies within r=120 for 2s |

All players start with `code_review`. Additional weapons are gained via the "Learn a new framework" upgrade.

Cooldown is divided by `player.fireRateMultiplier`. Pierce is summed with `player.bonusPierce`.

When `player.projectileCount > 1`, non-passive weapons fire multiple projectiles per shot, fanned out symmetrically around the facing direction (0.25 rad apart). The original facing is restored after firing so there are no side effects on movement or AI. Weapons that ignore facing (e.g. `stackoverflow`) simply fire N times in their fixed pattern.

---

## Wave Progression (`waves.js`)

- **WaveManager** ticks every 30s, `currentWave` 1–20
- Each tick: spawn `min(2 + wave/2, 8)` enemies + elite check
- Elite spawns: PM at wave 5+, EM at wave 8+, VP at wave 12+
- Boss spawns once at wave 20 (`bossSpawned` flag)
- Enemy type pool expands: bugs (w4), features (w5), merges (w8), flakies (w12)
- Spawn position: random angle, 500–700px from player centroid (off-screen)
- All stats scale by `1 + (wave - 1) * 0.05`

---

## Upgrades (`upgrades.js`)

`rollUpgrades(3)` picks 3 random from pool. `applyUpgrade(player, id)` applies effect.

| ID | Name | Effect |
|----|------|--------|
| `new_weapon` | "Learn a new framework" | Adds a random unowned weapon |
| `damage` | "Senior engineer review" | `damageMultiplier += 0.2` |
| `speed` | "Agile methodology" | `speed *= 1.15` |
| `hp` | "Work-life balance" | `maxHp += 25`, full heal |
| `fire_rate` | "Caffeinated" | `fireRateMultiplier += 0.2` |
| `pickup` | "Networking skills" | `pickupRadius *= 1.5` |
| `pierce` | "Vertical slice" | `bonusPierce += 1` |
| `aoe` | "Scope creep" | `aoeMultiplier += 0.25` |
| `multishot` | "Pair programming" | `projectileCount += 1` — fire an extra projectile per shot |

XP formula: `xpToNext = 10 + level * 5`

---

## Rendering (`renderer.js`)

- Camera: smooth lerp toward player centroid
- Screen shake: intensity + timer, applied as random translate offset
- Floating texts: world-space, rise + fade over ~0.8s
- Sprites: programmatic pixel art cached to offscreen canvases (`sprites.js`)
- HUD: wave/time top-left, engineer count top-right, mini HP bars per player
- Pause overlay: semi-transparent black + "LEVEL UP!" + player name/color

---

## Humor / Flavor

- **Wave messages**: "Sprint 5 begins... The backlog grows."
- **Damage text**: `-42 LOC deleted`
- **Death messages**: "Mass-laid-off", "PR rejected by the universe", "Segfault in production"
- **Player names**: "Junior Dev", "The Intern", "Staff Engineer", "10x Engineer", etc.
- **Victory**: "You have been... not replaced. For now."
- **Game over**: "Your job is safe... until the next reorg."
- **Upgrade names**: "Learn a new framework", "Work-life balance", "Agile methodology"

---

## Known Gaps / Future Work

- No actual QR code (shows URL as text instead — needs a QR library or pre-generated image)
- No arena boundaries — world is infinite
- Debug player (id: -1) auto-picks first upgrade after 1s
- No persistent scores / leaderboard
- No sound for wave start beyond wave 1
