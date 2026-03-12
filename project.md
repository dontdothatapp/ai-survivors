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
├── server.js              # HTTP static server + WebSocket relay + character selection
├── Avatars/               # Original hand-drawn character PNGs (~1.5MB each)
└── public/
    ├── game.html           # Game screen (laptop/TV)
    ├── controller.html     # Phone controller
    ├── avatars/            # Optimized character PNGs (~30-40KB each, 256px) + aleksei ally avatar
    ├── sounds/             # Audio files (aleksei.mp3, ai_final_boss.mp3)
    ├── css/
    │   ├── game.css
    │   └── controller.css
    └── js/
        ├── game/
        │   ├── main.js         # Game loop, orchestration, lobby/game-over flow
        │   ├── renderer.js     # All canvas drawing, camera, screen shake, floating text
        │   ├── entities.js     # Player, Enemy, Projectile, XPGem, Ally classes
        │   ├── characters.js   # Character definitions (id, name, title, avatar, color)
        │   ├── waves.js        # WaveManager — enemy spawning & progression
        │   ├── weapons.js      # WEAPON_DEFS + updateWeapons()
        │   ├── upgrades.js     # Upgrade pool + rollUpgrades() / applyUpgrade()
        │   ├── globalEvents.js # GlobalEventManager — predefined per-sprint events
        │   ├── config.js       # GAME_CONFIG — persistent admin settings (localStorage)
        │   ├── sprites.js      # Programmatic pixel art + avatar image loading/caching
        │   ├── sound.js        # Web Audio API retro beeps + Aleksei ally music + boss fight music
        │   └── network.js      # Game-screen WebSocket client + broadcast helpers
        └── controller/
            ├── controller.js  # Phone WS connection, character select, state display, upgrade UI
            └── joystick.js    # Touch/mouse joystick (~80 lines)
```

### Server (`server.js`)
- Manages character selection state server-side (`takenCharacters` Map); forwards other message types (`state`, `upgrade_prompt`, `upgrade_resolved`, `game_start`, `game_over`) to controllers
- HTTP: serves `public/` as static files with MIME types
- WebSocket routes:
  - `/game` → game screen (one connection)
  - `/controller` → phone controllers (up to 9)
- Assigns player IDs, handles `character_select` / `character_confirmed` / `character_rejected` flow before forwarding `player_joined` to game screen
- Broadcasts `characters_update` (taken character list) to all controllers when selections change
- Releases character on controller disconnect
- Detects local IP and prints game + controller URLs on start

### Game Screen
- All game logic runs in the browser
- `main.js` owns the game loop (`requestAnimationFrame`), imports all modules
- Camera tracks centroid of alive players (smooth lerp)
- Keyboard fallback: press **Space** to add debug player, **WASD/arrows** to move, **Enter** to start

### Phone Controller
- Connects to `/controller`, receives assigned player ID + list of taken characters
- **Character selection screen**: "CHOOSE YOUR FIGHTER" — 3×3 grid of character avatars; taken characters are grayed out; tapping sends `character_select`; on confirmation transitions to joystick
- Touch joystick sends `{type:"input", dx, dy}` at ~30 Hz
- HUD shows selected character avatar + name, HP bar, team XP bar, team level
- On level-up: all controllers show 3 upgrade vote buttons simultaneously; after voting shows "Waiting for others..."
- Screen wake lock via `navigator.wakeLock`

---

## Networking Protocol

| Direction | Message | Notes |
|-----------|---------|-------|
| Server → Phone | `{type:"assigned", playerId, taken:[...]}` | on connect, includes taken character IDs |
| Phone → Server | `{type:"character_select", characterId}` | pick a character |
| Server → Phone | `{type:"character_confirmed", characterId}` | selection accepted |
| Server → Phone | `{type:"character_rejected", characterId}` | character already taken |
| Server → All phones | `{type:"characters_update", taken:[...]}` | broadcast when selections change |
| Server → Game | `{type:"player_joined", playerId, characterId}` | after character selected |
| Server → Game | `{type:"player_left", playerId}` | on disconnect |
| Phone → Game | `{type:"input", playerId, dx, dy}` | 30 Hz |
| Game → All phones | `{type:"state", teamXP:{…}, players:[{…, characterId}]}` | 5 Hz |
| Game → All phones | `{type:"upgrade_prompt", options}` | on team level-up |
| Phone → Game | `{type:"upgrade_pick", upgradeId}` | vote for upgrade |
| Game → All phones | `{type:"upgrade_resolved"}` | dismiss vote UI |
| Phone → Game | `{type:"request_start"}` | start from phone |
| Game → All phones | `{type:"game_start"}` / `{type:"game_over", victory, stats}` | flow events |

---

## Game Loop (`main.js`)

Each frame:
1. **Voting pause check** — if `votingState !== null`, skip simulation, render voting overlay with upgrade cards + colored vote dots
2. `WaveManager.update()` — ticks sprint timer; if sprint pause active, counts down and returns early
3. **Sprint pause check** — if new sprint just started (3s), skip simulation, render sprint announcement overlay; on transition spawn featured enemy
4. **Global event pause check** — if `globalEventManager.pauseActive`, skip simulation, render event announcement overlay; on transition execute the event effect
5. **Mid-sprint trigger** — at the midpoint of each sprint (22.5s), trigger the predefined global event for that sprint with 3s pause
6. Player `update(dt)` — apply joystick input, move, update duck orbit angle
3. Soft player-player collision (push apart)
4. Coffee aura boost (temporarily bumps `fireRateMultiplier`)
5. `updateWeapons(dt, player, projectiles, enemies)` for each player
6. Rubber duck contact damage check
7. Enemy update — feedback enemies fly straight (skip AI), others: frozen timer then type-specific AI
7b. Ally update — move linearly, damage enemies on contact, cleanup when off-screen; stop Aleksei music when ally leaves
8. Projectile update + enemy collision detection
9. Enemy-player contact damage
10. XP gem magnet + collection → team XP pool → voting trigger on level-up
11. Cleanup dead entities
13. Game-over check (all dead / boss defeated)
14. Camera update → soft-pull players toward viewport → render
15. Broadcast state to phones (5 Hz)

---

## Entities

### Player
- `id`, `characterId`, `color`, `name`, `avatar`, `x/y`, `dx/dy` (joystick input), `facingX/Y`
- Stats: `speed=150`, `radius=14`, `hp/maxHp=100`, `pickupRadius=50`
- Multipliers: `damageMultiplier`, `fireRateMultiplier`, `aoeMultiplier`
- `bonusPierce` — added to all projectile pierce values
- `projectileCount` — number of projectiles fired per shot (1 by default); extras are fanned out at ±0.25 rad intervals around the facing direction
- `weapons[]` — array of `{type, cooldown}` objects
- `level` — synced from team XP pool on level-up
- `invincibleTimer` — brief i-frames after taking damage (0.3s)

### Enemy Types

| Type | HP | Speed | Notes |
|------|----|-------|-------|
| `jira` | 15 | 60 | Basic walker |
| `bug` | 10 | 110 | Zigzag movement |
| `pm` | 150 | 35 | Elite — spawns JIRA tickets every 4s |
| `em` | 200 | 30 | Elite — chases players |
| `vp` | 300 | 25 | Elite — spawns 3 jira minions every 10s |
| `ceo` | 600 | 20 | Elite — spawns 2 PMs every 6s |
| `ai_mini` | 10% of boss HP | 55 | Mini AI — spawned by "WE NEED AI" global event, uses boss sprite at 48px |
| `boss` | 2000+ | 20 | 3 phases (see below) |

### Boss — THE AI (sprint 7)
- `ai_final_boss.mp3` loops for the duration of the boss fight and continues through the end credits on victory
- **Phase 1** (>66% HP): spawns enemy clusters every 4s
- **Phase 2** (33–66%): hallucination — spawns 4 flaky enemies every 1.5s
- **Phase 3** (<33%): spawns bugs every 2s, speed bumps to 35

### Projectile
- `vx/vy`, `damage`, `pierce` (decrements per hit), `hitEnemies` Set
- `isAOE` flag — AOE projectiles check radius instead of point collision
- `homing` flag — hotfix projectiles steer toward nearest enemy

### Ally
- Spawned by the Aleksei global event (sprint 3)
- `characterId='aleksei'`, `radius=40` (boss size), `damage=5`
- Moves in a straight line across the screen through the player area
- Damages enemies on contact with 0.5s cooldown per enemy (via `hitCooldowns` Map)
- `update(dt, enemies)` returns list of killed enemies
- Rendered at 64x64 with green glow ring; Aleksei avatar image preloaded via `preloadAllyAvatar()`
- Aleksei.mp3 music plays while ally is on screen, stops when ally leaves

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

- **7 sprints**, 45s each (or fewer kills — see Admin Panel). Each sprint introduces one new enemy type.
- On sprint start: 3-second pause showing the sprint title + new enemy preview (sprite + name)
- After the pause, the featured enemy spawns immediately near players
- Enemy pool unlocks per sprint: jira (s1), bug (s2), pm (s3), em (s4), vp (s5), ceo (s6)
- Pool weights: jira/bug are common (3× weight), elites are rare (1× each)
- Boss spawns once at sprint 7 (`bossSpawned` flag); no other enemies spawn that sprint
- Spawn count: `min(1 + wave, 6)` per batch; rate `max(0.8, 3 - wave * 0.25)` seconds
- Spawn position: random angle, 500–700px from player centroid (off-screen)
- All stats scale by `1 + (wave - 1) * 0.05`
- **Enemy cap**: `MAX_ENEMIES = 40` — both the wave spawner and the inline `spawnEnemy()` callback (used by PM/CEO/boss abilities) refuse to push new enemies when 40 are alive

### Sprint Progression

| Sprint | New Enemy | Message |
|--------|-----------|---------|
| 1 | Jira Ticket | "Sprint 1 begins... The backlog grows." |
| 2 | Bug Report | "The bugs are multiplying." |
| 3 | Product Manager | "A wild Product Manager appears!" |
| 4 | Engineering Manager | "The Engineering Manager wants a word." |
| 5 | VP of Engineering | "The VP has 'ideas'." |
| 6 | CEO | "The CEO has entered the building." |
| 7 | THE AI (boss) | "FINAL SPRINT... THE AI HAS AWAKENED." |

---

## Upgrades (`upgrades.js`)

`rollUpgrades(3)` picks 3 random from pool. `applyUpgrade(player, id)` applies to one player. `applyUpgradeToAll(players, id)` applies to all alive players — for `new_weapon`, pre-rolls one random weapon and gives the same weapon to all. Each upgrade (except `new_weapon`) also has a `revert()` function used by the Micromanager global event. `revertUpgradeFromAll(players, id)` reverts a specific upgrade on all alive players (with safe minimums).

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

XP formula: `xpToNext = Math.round(15 × xpMultiplier^(level-1))` — exponential scaling controlled by `GAME_CONFIG.xpMultiplier` (default 1.5)

### Team XP & Voting

XP is shared in a single **team pool** (`teamXP` in `main.js`). When the team levels up, all alive players vote on one of 3 randomly rolled upgrades. The main screen shows a voting overlay with upgrade cards and colored dots representing each player's vote. Once all alive players have voted (or disconnected players are removed), the upgrade with the most votes wins (ties broken randomly) and is applied to all alive players via `applyUpgradeToAll()`. Dead players skip voting. Debug player (id=-1) auto-votes for the first option after 1s.

---

## Rendering (`renderer.js`)

- Camera: smooth lerp toward player centroid
- Screen shake: intensity + timer, applied as random translate offset
- Floating texts: world-space, rise + fade over ~0.8s
- Sprites: programmatic pixel art cached to offscreen canvases (`sprites.js`); player avatars loaded from `/avatars/` PNGs (preloaded on game screen load, fallback to pixel sprite if not loaded)
- In-game player display: HP bar above character, character name below
- HUD: wave/time top-left, engineer count top-right, mini HP bars per player, team XP bar top-center, debug enemy-count overlay bottom-left (total alive + per-type breakdown sorted by count)
- Voting overlay: dark overlay + "LEVEL UP!" title + 3 upgrade cards (name + description) + colored vote dots below each card + vote progress counter
- Sprint announcement overlay: dark overlay + sprint title + "NEW THREAT DETECTED" + enemy sprite (96×96, pixel-art scaled) + enemy name + countdown
- Ally rendering: 64x64 avatar image with green glow ring (drawn between enemies and players)
- Global event announcement overlay: dark overlay + scanline flicker + label + pulsing event name (42px bold) + description + countdown; red theme for negative events, green theme for positive (aleksei)

---

## Global Events (`globalEvents.js`)

Predefined events that fire once per sprint at the midpoint (22.5s into each 45s sprint, sprints 1–6). Each sprint has a fixed event via `SPRINT_EVENT_MAP`. The game pauses for 3 seconds showing a dramatic full-screen overlay with 8-bit alarm sound, then the event effect executes when the pause ends. Positive events (aleksei) use green-themed styling ("ALLY INCOMING" label, green scanlines).

| Sprint | ID | Name | Description | Effect |
|--------|----|------|-------------|--------|
| 1 | `new_teams` | NEW TEAMS | 20% of enemies just got promoted | Promotes 20% of alive enemies up the hierarchy (jira→bug→feature→pm→em→vp→ceo) |
| 2 | `we_need_ai` | WE NEED AI | 10 AI-powered enemies have entered the chat | Spawns 10 `ai_mini` enemies around players (bypasses 40-enemy cap) |
| 3 | `aleksei` | ALEKSEI | A friendly face has appeared to help! | Spawns an `Ally` that crosses the screen dealing 5 damage to enemies on contact; plays Aleksei.mp3 music |
| 4 | `micromanager` | MICROMANAGER | 2 random upgrades have been downgraded | Reverts up to 2 previously applied upgrades (excluding `new_weapon`) |
| 5 | `feedback` | FEEDBACK | 10 jira tickets are flying your way! | Spawns 10 jira enemies flying in straight lines toward players (`isFeedback` flag, bypass cap, skip normal AI, despawn at 1500px) |
| 6 | `reorg` | REORG | One random engineer has been let go | Kills one random alive player |

The `GlobalEventManager` tracks `upgradeHistory[]` (populated via `recordUpgrade()` on each vote resolution) so the Micromanager event knows which upgrades to revert.

---

## Humor / Flavor

- **Wave messages**: "Sprint 5 begins... The backlog grows."
- **Damage text**: `-42 LOC deleted`
- **Death messages**: "Mass-laid-off", "PR rejected by the universe", "Segfault in production"
- **Characters**: 9 named characters (Eldar, Emil, Illia, Leonid, Lev, Levan, Nikita, Ruslan, Stepan) each with a hand-drawn avatar and a fun title ("Junior Dev", "The Intern", "Full Stack Overlord", etc.)
- **Victory**: End credits roll (movie-style bottom-to-top scroll) over boss music, then shows "You have been... not replaced. For now." with stats
- **Game over**: "Your job is safe... until the next reorg."
- **Upgrade names**: "Learn a new framework", "Work-life balance", "Agile methodology"

---

---

## Admin Panel

Accessible via the **⚙ ADMIN** button on the lobby screen. Settings persist in `localStorage` and become the new defaults for all future sessions.

| Setting | Description | Default |
|---------|-------------|---------|
| **Enemy Base HP** | Per-type HP before wave scaling (+5%/wave). Covers jira, bug, pm, em, vp, ceo, boss. | See entity table above |
| **Kills to advance sprint** | Number of kills in the current sprint that trigger the next sprint early. `0` = time-based only (45s). | 0 |
| **XP multiplier** | Each level-up requires this multiple of the previous threshold. `1.5` → Lv2 needs 23 XP, Lv3 needs 34, etc. | 1.5 |
| **Global Events** | Editable name and description for each of the 6 global events. Changes apply immediately to the in-memory `EVENTS` array. | See Global Events table |

`RESET DEFAULTS` restores all values and clears localStorage.

---

## End Credits

On victory (boss defeated), a cinematic scrolling credits sequence plays while the boss battle music continues looping. The credits scroll bottom-to-top over ~50 seconds and include:

1. **Title** — "AI SURVIVORS" with subtitle
2. **Cast** — All characters (9 players + Aleksei) listed as playing themselves
3. **Crew** — Game Director, Lead Programmer, Pixel Artist, Sound Designer, Composer, Level Designer, QA Tester, Writer, Producer (all AI), and Conductor (Stepan)
4. **Special Thanks** — Leonid

A **SKIP** button in the bottom-right allows skipping to the victory stats screen. After credits end (or skip), boss music stops and the normal victory game-over screen appears with stats and PLAY AGAIN button.

Implemented in: `game.html` (credits DOM), `game.css` (scrolling animation + styles), `main.js` (`showCredits()` function).

---

## Known Gaps / Future Work

- No actual QR code (shows URL as text instead — needs a QR library or pre-generated image)
- Players are soft-pulled toward the visible viewport (gentle force, not hard clamp)
- Debug player (id: -1) auto-votes for first upgrade option after 1s
- No persistent scores / leaderboard
- No sound for wave start beyond wave 1
