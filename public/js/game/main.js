// Main game loop — orchestration, canvas setup, state management
import { Player, Enemy, Projectile, XPGem } from './entities.js';
import { WEAPON_DEFS, updateWeapons } from './weapons.js';
import { WaveManager } from './waves.js';
import { rollUpgrades, applyUpgrade } from './upgrades.js';
import { Renderer } from './renderer.js';
import * as network from './network.js';
import * as sound from './sound.js';

// --- State ---
const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas);

let players = [];
let enemies = [];
let projectiles = [];
let xpGems = [];
let waveManager = new WaveManager();
let gameTime = 0;
let gameState = 'lobby'; // lobby | playing | gameover
let lobbyPlayers = new Map(); // id -> {id, color, name}

// Player colors & names
const PLAYER_COLORS = ['#ff4466', '#44bbff', '#44ff88', '#ffcc44', '#ff88ff', '#88ffff', '#ffaa44', '#aa88ff'];
const PLAYER_NAMES = ['Junior Dev', 'The Intern', 'Staff Engineer', '10x Engineer', 'DevOps Guru', 'Script Kiddie', 'Legacy Code Owner', 'The Architect'];

// --- Lobby ---
const lobbyEl = document.getElementById('lobby');
const hudEl = document.getElementById('hud');
const gameOverEl = document.getElementById('gameOver');
const startBtn = document.getElementById('startBtn');
const playersUl = document.getElementById('players');
const joinUrlEl = document.getElementById('joinUrl');
const waveAnnouncementEl = document.getElementById('waveAnnouncement');

// QR code
function generateQRUrl() {
  const url = `${location.protocol}//${location.host}/controller.html`;
  joinUrlEl.textContent = url;
  // Simple QR code using an external API rendered to canvas
  const qrCanvas = document.getElementById('qrCanvas');
  const qrCtx = qrCanvas.getContext('2d');
  qrCtx.fillStyle = '#fff';
  qrCtx.fillRect(0, 0, 200, 200);
  qrCtx.fillStyle = '#000';
  qrCtx.font = 'bold 14px "Courier New"';
  qrCtx.textAlign = 'center';
  qrCtx.fillText('Open this URL', 100, 80);
  qrCtx.fillText('on your phone:', 100, 100);
  qrCtx.font = '10px "Courier New"';
  // Wrap the URL
  const parts = url.match(/.{1,24}/g) || [url];
  parts.forEach((part, i) => {
    qrCtx.fillText(part, 100, 125 + i * 16);
  });
}

function updateLobbyUI() {
  playersUl.innerHTML = '';
  for (const [id, info] of lobbyPlayers) {
    const li = document.createElement('li');
    li.textContent = info.name;
    li.style.borderColor = info.color;
    li.style.color = info.color;
    playersUl.appendChild(li);
  }
  startBtn.disabled = lobbyPlayers.size === 0;
}

startBtn.addEventListener('click', () => {
  if (lobbyPlayers.size === 0) return;
  sound.unlockAudio();
  startGame();
});

// --- Network ---
network.connect((msg) => {
  switch (msg.type) {
    case 'player_joined': {
      const id = msg.playerId;
      lobbyPlayers.set(id, {
        id,
        color: PLAYER_COLORS[id % PLAYER_COLORS.length],
        name: PLAYER_NAMES[id % PLAYER_NAMES.length],
      });
      if (gameState === 'lobby') updateLobbyUI();
      if (gameState === 'playing') {
        // Hot join — add player mid-game
        addPlayer(id);
      }
      break;
    }
    case 'player_left': {
      lobbyPlayers.delete(msg.playerId);
      if (gameState === 'lobby') updateLobbyUI();
      if (gameState === 'playing') {
        const p = players.find(pl => pl.id === msg.playerId);
        if (p) p.alive = false;
      }
      break;
    }
    case 'input': {
      const p = players.find(pl => pl.id === msg.playerId);
      if (p && p.alive) {
        p.dx = msg.dx || 0;
        p.dy = msg.dy || 0;
      }
      break;
    }
    case 'upgrade_pick': {
      const p = players.find(pl => pl.id === msg.playerId);
      if (p && p.pendingUpgrade) {
        applyUpgrade(p, msg.upgradeId);
        p.pendingUpgrade = false;
      }
      break;
    }
    case 'request_start': {
      if (gameState === 'lobby' && lobbyPlayers.size > 0) {
        sound.unlockAudio();
        startGame();
      }
      break;
    }
  }
});

// --- Keyboard debug controls ---
const keysDown = new Set();
window.addEventListener('keydown', (e) => {
  keysDown.add(e.key.toLowerCase());
  if (e.key === ' ' && gameState === 'lobby' && lobbyPlayers.size === 0) {
    // Debug: add keyboard player
    sound.unlockAudio();
    lobbyPlayers.set(-1, { id: -1, color: PLAYER_COLORS[0], name: 'Debug Dev' });
    updateLobbyUI();
  }
  if (e.key === 'Enter' && gameState === 'lobby' && lobbyPlayers.size > 0) {
    sound.unlockAudio();
    startGame();
  }
});
window.addEventListener('keyup', (e) => keysDown.delete(e.key.toLowerCase()));

function addPlayer(id) {
  const p = new Player(id);
  // Spread players out
  const angle = (players.length / 8) * Math.PI * 2;
  p.x = Math.cos(angle) * 60;
  p.y = Math.sin(angle) * 60;
  players.push(p);
  return p;
}

function startGame() {
  gameState = 'playing';
  lobbyEl.style.display = 'none';
  hudEl.style.display = 'block';
  gameOverEl.style.display = 'none';

  players = [];
  enemies = [];
  projectiles = [];
  xpGems = [];
  gameTime = 0;
  waveManager = new WaveManager();

  for (const [id] of lobbyPlayers) {
    addPlayer(id);
  }

  waveManager.start();
  network.send({ type: 'game_start' });
  sound.playWaveStart();
}

// --- Game Over ---
function showGameOver(victory) {
  gameState = 'gameover';
  gameOverEl.style.display = 'flex';
  hudEl.style.display = 'none';

  const titleEl = document.getElementById('gameOverTitle');
  const textEl = document.getElementById('gameOverText');
  const statsEl = document.getElementById('gameOverStats');

  if (victory) {
    titleEl.textContent = 'VICTORY';
    titleEl.style.color = '#00ff88';
    textEl.textContent = 'You have been... not replaced. For now.';
    sound.playVictory();
  } else {
    titleEl.textContent = 'GAME OVER';
    titleEl.style.color = '#ff4444';
    textEl.textContent = 'Your job is safe... until the next reorg.';
    sound.playDeath();
  }

  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);
  let statsText = `Time survived: ${minutes}:${seconds.toString().padStart(2, '0')}\n`;
  statsText += `Waves completed: ${waveManager.currentWave}\n\n`;

  let mvp = null;
  let maxKills = -1;
  for (const p of players) {
    statsText += `${p.name}: ${p.kills} kills, Lv ${p.level}\n`;
    if (p.kills > maxKills) { maxKills = p.kills; mvp = p; }
  }
  if (mvp) statsText += `\nMVP: ${mvp.name}`;
  statsEl.textContent = statsText;

  network.sendGameOver(victory, { time: gameTime, wave: waveManager.currentWave });

  document.getElementById('restartBtn').onclick = () => {
    gameState = 'lobby';
    gameOverEl.style.display = 'none';
    lobbyEl.style.display = 'flex';
    updateLobbyUI();
  };
}

// --- Game Loop ---
let lastTime = 0;
let stateBroadcastTimer = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = timestamp;

  if (gameState !== 'playing') return;

  // Pause when any player is choosing an upgrade
  const pausedForUpgrade = players.some(p => p.pendingUpgrade);
  if (pausedForUpgrade) {
    // Still render but skip simulation
    renderer.updateCamera(players, dt);
    renderer.render({
      players, enemies, projectiles, xpGems,
      wave: waveManager.currentWave,
      gameTime,
      paused: true,
      pausedPlayer: players.find(p => p.pendingUpgrade),
    });
    // Keep broadcasting state so phones stay updated
    stateBroadcastTimer -= dt;
    if (stateBroadcastTimer <= 0) {
      stateBroadcastTimer = 0.2;
      network.broadcastState(players);
    }
    return;
  }

  // Advance wave manager (handles sprint pause countdown internally)
  const wasSprintPaused = waveManager.sprintPauseActive;
  waveManager.update(dt, enemies, players, 0, 0);

  // When sprint pause just ended, spawn the featured enemy near players
  if (wasSprintPaused && !waveManager.sprintPauseActive && waveManager.newEnemy) {
    let cx = 0, cy = 0, count = 0;
    for (const p of players) {
      if (p.alive) { cx += p.x; cy += p.y; count++; }
    }
    if (count > 0) { cx /= count; cy /= count; }
    const angle = Math.random() * Math.PI * 2;
    const dist = 450 + Math.random() * 150;
    spawnEnemy(waveManager.newEnemy.type, cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
  }

  // Sprint start pause — freeze game, show announcement
  if (waveManager.sprintPauseActive) {
    renderer.updateCamera(players, dt);
    renderer.render({
      players, enemies, projectiles, xpGems,
      wave: waveManager.currentWave,
      gameTime,
      sprintPause: true,
      sprintMessage: waveManager.waveMessage,
      sprintNewEnemy: waveManager.newEnemy,
      sprintPauseTimer: waveManager.sprintPauseTimer,
    });
    stateBroadcastTimer -= dt;
    if (stateBroadcastTimer <= 0) {
      stateBroadcastTimer = 0.2;
      network.broadcastState(players);
    }
    return;
  }

  gameTime += dt;

  // Debug keyboard input for player -1
  const debugPlayer = players.find(p => p.id === -1);
  if (debugPlayer && debugPlayer.alive) {
    debugPlayer.dx = (keysDown.has('d') || keysDown.has('arrowright') ? 1 : 0) - (keysDown.has('a') || keysDown.has('arrowleft') ? 1 : 0);
    debugPlayer.dy = (keysDown.has('s') || keysDown.has('arrowdown') ? 1 : 0) - (keysDown.has('w') || keysDown.has('arrowup') ? 1 : 0);
  }

  // Update players
  for (const p of players) {
    p.update(dt);
  }

  // Soft collision between players
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius;
      if (dist < minDist && dist > 0) {
        const push = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // Coffee aura — boost fire rate for nearby allies
  for (const p of players) {
    p.coffeeActive = false;
  }
  for (const p of players) {
    if (!p.alive) continue;
    const hasCoffee = p.weapons.some(w => w.type === 'coffee');
    if (!hasCoffee) continue;
    p.coffeeActive = true;
    const def = WEAPON_DEFS.coffee;
    for (const other of players) {
      if (other === p || !other.alive) continue;
      const d = Math.hypot(other.x - p.x, other.y - p.y);
      if (d < def.auraRadius) {
        other.coffeeActive = true;
      }
    }
  }

  // Apply coffee boost temporarily during weapon update
  for (const p of players) {
    if (p.coffeeActive) {
      p._origFireRate = p.fireRateMultiplier;
      p.fireRateMultiplier *= 1.3;
    }
  }

  // Update weapons & fire
  for (const p of players) {
    updateWeapons(dt, p, projectiles, enemies);
  }

  // Restore fire rate
  for (const p of players) {
    if (p._origFireRate !== undefined) {
      p.fireRateMultiplier = p._origFireRate;
      delete p._origFireRate;
    }
  }

  // Rubber duck contact damage
  for (const p of players) {
    if (!p.alive) continue;
    if (!p.weapons.some(w => w.type === 'rubber_duck')) continue;
    if (!p._duckHitCooldowns) p._duckHitCooldowns = new Map();
    // Decrement cooldowns and remove expired
    for (const [enemy, timer] of p._duckHitCooldowns) {
      const newTimer = timer - dt;
      if (newTimer <= 0) p._duckHitCooldowns.delete(enemy);
      else p._duckHitCooldowns.set(enemy, newTimer);
    }
    const def = WEAPON_DEFS.rubber_duck;
    const duckX = p.x + Math.cos(p.rubberDuckAngle) * def.orbitRadius;
    const duckY = p.y + Math.sin(p.rubberDuckAngle) * def.orbitRadius;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (p._duckHitCooldowns.has(e)) continue;
      const d = Math.hypot(e.x - duckX, e.y - duckY);
      if (d < e.radius + 8) {
        const damage = def.orbitDamage * p.damageMultiplier;
        const killed = e.takeDamage(damage);
        p._duckHitCooldowns.set(e, 0.5);
        if (killed) {
          onEnemyKilled(e, p);
        } else {
          sound.playHit();
          renderer.addFloatingText(e.x, e.y - 10, '-' + Math.floor(damage) + ' LOC', '#ff8844');
        }
      }
    }
  }

  // Enemy frozen timer
  for (const e of enemies) {
    if (e.frozenTimer === undefined) e.frozenTimer = 0;
    if (e.frozenTimer > 0) {
      e.frozenTimer -= dt;
      continue; // skip movement
    }
    e.update(dt, players, enemies, spawnEnemy);
  }

  // Update projectiles
  for (const p of projectiles) {
    p.update(dt, enemies);
  }

  // Projectile-enemy collisions
  for (const proj of projectiles) {
    if (!proj.alive) continue;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (proj.isAOE) {
        const d = Math.hypot(e.x - proj.x, e.y - proj.y);
        if (d < proj.aoe && proj.hitEnemy(e)) {
          const killed = e.takeDamage(proj.damage);
          if (killed) {
            const owner = players.find(p => p.id === proj.ownerId);
            onEnemyKilled(e, owner);
          } else {
            sound.playHit();
            renderer.addFloatingText(e.x, e.y - 10, `-${Math.floor(proj.damage)} LOC`, '#ff8844');
          }
        }
      } else {
        const d = Math.hypot(e.x - proj.x, e.y - proj.y);
        if (d < e.radius + proj.radius) {
          if (proj.hitEnemy(e)) {
            const killed = e.takeDamage(proj.damage);
            if (killed) {
              const owner = players.find(p => p.id === proj.ownerId);
              onEnemyKilled(e, owner);
            } else {
              sound.playHit();
              renderer.addFloatingText(e.x, e.y - 10, `-${Math.floor(proj.damage)} LOC`, '#ff8844');
            }
          }
        }
      }
    }
  }

  // Enemy-player collisions
  for (const e of enemies) {
    if (!e.alive) continue;
    for (const p of players) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < p.radius + e.radius) {
        const died = p.takeDamage(e.damage * dt * 3); // damage per second on contact
        if (died) {
          sound.playDeath();
          renderer.addFloatingText(p.x, p.y - 20, p.getDeathMessage(), '#ff4444', 2);
        } else if (p.invincibleTimer <= 0.3 && p.invincibleTimer > 0.28) {
          sound.playPlayerHit();
        }
        // Push player away
        if (d > 0) {
          const nx = (p.x - e.x) / d;
          const ny = (p.y - e.y) / d;
          p.x += nx * 2;
          p.y += ny * 2;
        }
      }
    }
  }

  // XP gems
  for (const gem of xpGems) {
    const collector = gem.update(dt, players);
    if (collector) {
      sound.playPickup();
      const leveled = collector.addXP(gem.value);
      if (leveled) {
        sound.playLevelUp();
        triggerLevelUp(collector);
      }
    }
  }

  // Wave announcement
  if (waveManager.waveMessageTimer > 0) {
    waveAnnouncementEl.textContent = waveManager.waveMessage;
    waveAnnouncementEl.style.opacity = Math.min(waveManager.waveMessageTimer, 1);
  } else {
    waveAnnouncementEl.style.opacity = 0;
  }

  // Clean up dead entities
  enemies = enemies.filter(e => e.alive);
  projectiles = projectiles.filter(p => p.alive);
  xpGems = xpGems.filter(g => g.alive);

  // Check game over
  const allDead = players.every(p => !p.alive);
  if (allDead && players.length > 0) {
    showGameOver(false);
    return;
  }
  if (waveManager.bossDefeated) {
    showGameOver(true);
    return;
  }

  // Camera & render
  renderer.updateCamera(players, dt);

  // Clamp players to visible viewport
  for (const p of players) {
    if (!p.alive) continue;
    p.x = Math.max(renderer.camera.x + p.radius, Math.min(renderer.camera.x + renderer.width - p.radius, p.x));
    p.y = Math.max(renderer.camera.y + p.radius, Math.min(renderer.camera.y + renderer.height - p.radius, p.y));
  }

  renderer.render({
    players, enemies, projectiles, xpGems,
    wave: waveManager.currentWave,
    gameTime,
  });

  // Broadcast state to controllers
  stateBroadcastTimer -= dt;
  if (stateBroadcastTimer <= 0) {
    stateBroadcastTimer = 0.2; // 5 Hz
    network.broadcastState(players);
  }
}

function spawnEnemy(type, x, y) {
  enemies.push(new Enemy(type, x, y, waveManager.currentWave));
}

function onEnemyKilled(enemy, killer) {
  sound.playKill();
  renderer.addFloatingText(enemy.x, enemy.y - 10, `-${enemy.maxHp} LOC deleted`, '#ffcc44');
  renderer.addScreenShake(3, 0.1);
  waveManager.totalKills++;

  if (killer) killer.kills++;

  // Drop XP
  const gemCount = Math.ceil(enemy.xpValue / 3);
  for (let i = 0; i < gemCount; i++) {
    const angle = (i / gemCount) * Math.PI * 2;
    xpGems.push(new XPGem(
      enemy.x + Math.cos(angle) * 15,
      enemy.y + Math.sin(angle) * 15,
      Math.ceil(enemy.xpValue / gemCount)
    ));
  }

  // Feature Request splits into 2
  if (enemy.type === 'feature') {
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const child = new Enemy('jira', enemy.x + Math.cos(angle) * 20, enemy.y + Math.sin(angle) * 20, enemy.wave);
      child.hp = 10;
      child.maxHp = 10;
      enemies.push(child);
    }
  }
}

function triggerLevelUp(player) {
  player.pendingUpgrade = true;
  const options = rollUpgrades(3);
  // Send to phone controller
  network.sendUpgradePrompt(player.id, options.map(o => ({
    id: o.id,
    name: o.name,
    desc: o.desc,
  })));

  // If debug player (keyboard), auto-pick first option after 1s
  if (player.id === -1) {
    setTimeout(() => {
      if (player.pendingUpgrade) {
        applyUpgrade(player, options[0].id);
        player.pendingUpgrade = false;
      }
    }, 1000);
  }
}

// --- Init ---
generateQRUrl();
requestAnimationFrame(gameLoop);
