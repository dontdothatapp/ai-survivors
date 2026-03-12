// Main game loop — orchestration, canvas setup, state management
import { Player, Enemy, Projectile, XPGem, upgradeEnemyType } from './entities.js';
import { WEAPON_DEFS, updateWeapons } from './weapons.js';
import { WaveManager } from './waves.js';
import { rollUpgrades, applyUpgrade, applyUpgradeToAll, revertUpgradeFromAll } from './upgrades.js';
import { Renderer } from './renderer.js';
import { GlobalEventManager, EVENTS } from './globalEvents.js';
import { CHARACTERS } from './characters.js';
import { preloadAvatars } from './sprites.js';
import * as network from './network.js';
import * as sound from './sound.js';
import { GAME_CONFIG, saveConfig, resetConfig } from './config.js';

// --- Preload avatars ---
preloadAvatars(CHARACTERS);

// --- State ---
const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas);

let players = [];
let enemies = [];
let projectiles = [];
let xpGems = [];
let waveManager = new WaveManager();
let globalEventManager = new GlobalEventManager();
let midSprintEventFired = false;
let gameTime = 0;
let gameState = 'lobby'; // lobby | playing | gameover
let teamXP = { xp: 0, level: 1, xpToNext: 15 };
let votingState = null; // { options: [...], votes: Map<playerId, upgradeId> }
let lobbyPlayers = new Map(); // id -> {id, color, name, characterId, avatar}

// --- Lobby ---
const lobbyEl = document.getElementById('lobby');
const hudEl = document.getElementById('hud');
const gameOverEl = document.getElementById('gameOver');
const startBtn = document.getElementById('startBtn');
const playersUl = document.getElementById('players');
const joinUrlEl = document.getElementById('joinUrl');
const waveAnnouncementEl = document.getElementById('waveAnnouncement');

// --- Admin Panel ---
const adminBtn = document.getElementById('adminBtn');
const adminPanel = document.getElementById('adminPanel');
const adminCloseBtn = document.getElementById('adminCloseBtn');
const adminSaveBtn = document.getElementById('adminSaveBtn');
const adminResetBtn = document.getElementById('adminResetBtn');

const ENEMY_LABELS = {
  jira: 'Jira Ticket',
  bug: 'Bug Report',
  pm: 'Product Manager',
  em: 'Engineering Manager',
  vp: 'VP of Engineering',
  ceo: 'CEO',
  boss: 'THE AI (boss base HP)',
};

function openAdminPanel() {
  // Populate fields from current config
  for (const [key, label] of Object.entries(ENEMY_LABELS)) {
    const el = document.getElementById(`admin-hp-${key}`);
    if (el) el.value = GAME_CONFIG.enemyHp[key];
  }
  document.getElementById('admin-kills-per-sprint').value = GAME_CONFIG.killsPerSprint;
  document.getElementById('admin-xp-multiplier').value = GAME_CONFIG.xpMultiplier;

  // Populate global events
  const container = document.getElementById('admin-global-events');
  container.innerHTML = '';
  for (const event of EVENTS) {
    const row = document.createElement('div');
    row.className = 'admin-event-row';
    row.innerHTML = `
      <label class="admin-event-id">${event.id}</label>
      <input id="admin-event-name-${event.id}" type="text" value="${event.name}" placeholder="Name">
      <input id="admin-event-desc-${event.id}" type="text" value="${event.desc}" placeholder="Description">
    `;
    container.appendChild(row);
  }

  adminPanel.style.display = 'flex';
}

function closeAdminPanel() {
  adminPanel.style.display = 'none';
}

function saveAdminPanel() {
  for (const key of Object.keys(ENEMY_LABELS)) {
    const el = document.getElementById(`admin-hp-${key}`);
    if (el) {
      const val = parseInt(el.value, 10);
      if (!isNaN(val) && val > 0) GAME_CONFIG.enemyHp[key] = val;
    }
  }
  const killsEl = document.getElementById('admin-kills-per-sprint');
  const killsVal = parseInt(killsEl.value, 10);
  if (!isNaN(killsVal) && killsVal >= 0) GAME_CONFIG.killsPerSprint = killsVal;

  const xpEl = document.getElementById('admin-xp-multiplier');
  const xpVal = parseFloat(xpEl.value);
  if (!isNaN(xpVal) && xpVal >= 1) GAME_CONFIG.xpMultiplier = xpVal;

  // Save global event customizations
  for (const event of EVENTS) {
    const nameEl = document.getElementById(`admin-event-name-${event.id}`);
    const descEl = document.getElementById(`admin-event-desc-${event.id}`);
    if (nameEl && nameEl.value.trim()) event.name = nameEl.value.trim();
    if (descEl && descEl.value.trim()) event.desc = descEl.value.trim();
  }

  saveConfig();
  closeAdminPanel();
}

adminBtn.addEventListener('click', openAdminPanel);
adminCloseBtn.addEventListener('click', closeAdminPanel);
adminSaveBtn.addEventListener('click', saveAdminPanel);
adminResetBtn.addEventListener('click', () => {
  resetConfig();
  openAdminPanel(); // re-open to show reset values
});

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
    li.style.borderColor = info.color;
    li.style.color = info.color;
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '8px';
    if (info.avatar) {
      const img = document.createElement('img');
      img.src = info.avatar;
      img.style.width = '28px';
      img.style.height = '28px';
      img.style.objectFit = 'contain';
      li.appendChild(img);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = info.name;
    li.appendChild(nameSpan);
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
      const charId = msg.characterId;
      const char = CHARACTERS.find(c => c.id === charId);
      lobbyPlayers.set(id, {
        id,
        characterId: charId,
        color: char ? char.color : '#ff4466',
        name: char ? char.name : 'Player',
        avatar: char ? char.avatar : null,
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
        // Recheck voting if in progress
        if (votingState) {
          votingState.votes.delete(msg.playerId);
          const alivePlayers = players.filter(pl => pl.alive);
          if (alivePlayers.length > 0 && votingState.votes.size >= alivePlayers.length) {
            resolveVote();
          }
        }
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
      if (!votingState) break;
      const pid = msg.playerId;
      if (votingState.votes.has(pid)) break; // already voted
      const p = players.find(pl => pl.id === pid);
      if (!p || !p.alive) break;
      votingState.votes.set(pid, msg.upgradeId);
      // Check if all alive players have voted
      const alivePlayers = players.filter(pl => pl.alive);
      if (votingState.votes.size >= alivePlayers.length) {
        resolveVote();
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
    lobbyPlayers.set(-1, { id: -1, characterId: 'stepan', color: '#ff8844', name: 'Debug Dev', avatar: '/avatars/stepan.png' });
    updateLobbyUI();
  }
  if (e.key === 'Enter' && gameState === 'lobby' && lobbyPlayers.size > 0) {
    sound.unlockAudio();
    startGame();
  }
});
window.addEventListener('keyup', (e) => keysDown.delete(e.key.toLowerCase()));

function addPlayer(id) {
  const info = lobbyPlayers.get(id);
  const charInfo = info ? {
    id: info.characterId,
    color: info.color,
    name: info.name,
    avatar: info.avatar,
  } : null;
  const p = new Player(id, charInfo);
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
  teamXP = { xp: 0, level: 1, xpToNext: 15 };
  votingState = null;
  waveManager = new WaveManager();
  globalEventManager = new GlobalEventManager();
  midSprintEventFired = false;

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
  statsText += `Waves completed: ${waveManager.currentWave}\n`;
  statsText += `Team Level: ${teamXP.level}\n\n`;

  let mvp = null;
  let maxKills = -1;
  for (const p of players) {
    statsText += `${p.name}: ${p.kills} kills\n`;
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

  // Pause when voting is in progress
  if (votingState !== null) {
    // Still render but skip simulation
    renderer.updateCamera(players, dt);
    renderer.render({
      players, enemies, projectiles, xpGems,
      wave: waveManager.currentWave,
      gameTime,
      teamXP,
      paused: true,
      votingState: {
        options: votingState.options.map(o => ({ id: o.id, name: o.name, desc: o.desc })),
        votes: [...votingState.votes.entries()].map(([pid, uid]) => ({
          playerId: pid, upgradeId: uid,
          color: players.find(p => p.id === pid)?.color || '#fff'
        })),
        totalVoters: players.filter(p => p.alive).length,
      },
    });
    // Keep broadcasting state so phones stay updated
    stateBroadcastTimer -= dt;
    if (stateBroadcastTimer <= 0) {
      stateBroadcastTimer = 0.2;
      network.broadcastState(players, teamXP);
    }
    return;
  }

  // Advance wave manager (handles sprint pause countdown internally)
  const wasSprintPaused = waveManager.sprintPauseActive;
  waveManager.update(dt, enemies, players, 0, 0);

  // When sprint pause just ended, spawn the featured enemy near players and reset mid-sprint flag
  if (wasSprintPaused && !waveManager.sprintPauseActive && waveManager.newEnemy) {
    midSprintEventFired = false;
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
      teamXP,
      sprintPause: true,
      sprintMessage: waveManager.waveMessage,
      sprintNewEnemy: waveManager.newEnemy,
      sprintPauseTimer: waveManager.sprintPauseTimer,
    });
    stateBroadcastTimer -= dt;
    if (stateBroadcastTimer <= 0) {
      stateBroadcastTimer = 0.2;
      network.broadcastState(players, teamXP);
    }
    return;
  }

  // Global event pause — freeze game, show announcement, execute event when done
  const wasGlobalPaused = globalEventManager.pauseActive;
  globalEventManager.update(dt);

  if (wasGlobalPaused && !globalEventManager.pauseActive) {
    const pending = globalEventManager.consumePendingEvent();
    if (pending) executeGlobalEvent(pending);
  }

  if (globalEventManager.pauseActive) {
    renderer.updateCamera(players, dt);
    renderer.render({
      players, enemies, projectiles, xpGems,
      wave: waveManager.currentWave,
      gameTime,
      teamXP,
      globalEventAnnouncement: globalEventManager.getAnnouncement(),
    });
    stateBroadcastTimer -= dt;
    if (stateBroadcastTimer <= 0) {
      stateBroadcastTimer = 0.2;
      network.broadcastState(players, teamXP);
    }
    return;
  }

  gameTime += dt;

  // Trigger global event at mid-sprint (halfway through WAVE_DURATION = 45s)
  if (waveManager.currentWave > 0 && waveManager.currentWave < 7 &&
      !midSprintEventFired && waveManager.waveTimer <= 22.5) {
    midSprintEventFired = true;
    globalEventManager.trigger();
    sound.playGlobalEvent();
  }

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
        // Push player away (frame-rate independent)
        if (d > 0) {
          const nx = (p.x - e.x) / d;
          const ny = (p.y - e.y) / d;
          const pushSpeed = 120; // pixels per second
          p.x += nx * pushSpeed * dt;
          p.y += ny * pushSpeed * dt;
        }
      }
    }
  }

  // XP gems — team pool
  for (const gem of xpGems) {
    const collector = gem.update(dt, players);
    if (collector) {
      sound.playPickup();
      teamXP.xp += gem.value;
      if (teamXP.xp >= teamXP.xpToNext) {
        teamXP.xp -= teamXP.xpToNext;
        teamXP.level++;
        teamXP.xpToNext = Math.round(15 * Math.pow(GAME_CONFIG.xpMultiplier, teamXP.level - 1));
        sound.playLevelUp();
        triggerTeamLevelUp();
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

  // Soft-pull players back toward visible viewport (no hard clamp)
  for (const p of players) {
    if (!p.alive) continue;
    const margin = p.radius;
    const leftBound = renderer.camera.x + margin;
    const rightBound = renderer.camera.x + renderer.width - margin;
    const topBound = renderer.camera.y + margin;
    const bottomBound = renderer.camera.y + renderer.height - margin;
    const pullStrength = 8; // pixels per second per pixel of overshoot
    if (p.x < leftBound) p.x += (leftBound - p.x) * pullStrength * dt;
    if (p.x > rightBound) p.x += (rightBound - p.x) * pullStrength * dt;
    if (p.y < topBound) p.y += (topBound - p.y) * pullStrength * dt;
    if (p.y > bottomBound) p.y += (bottomBound - p.y) * pullStrength * dt;
  }

  renderer.render({
    players, enemies, projectiles, xpGems,
    wave: waveManager.currentWave,
    gameTime,
    teamXP,
  });

  // Broadcast state to controllers
  stateBroadcastTimer -= dt;
  if (stateBroadcastTimer <= 0) {
    stateBroadcastTimer = 0.2; // 5 Hz
    network.broadcastState(players, teamXP);
  }
}

function spawnEnemy(type, x, y) {
  if (enemies.filter(e => e.alive).length >= 40) return;
  enemies.push(new Enemy(type, x, y, waveManager.currentWave));
}

function onEnemyKilled(enemy, killer) {
  sound.playKill();
  renderer.addFloatingText(enemy.x, enemy.y - 10, `-${enemy.maxHp} LOC deleted`, '#ffcc44');
  renderer.addScreenShake(3, 0.1);
  waveManager.totalKills++;
  waveManager.sprintKills++;

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

function executeGlobalEvent(event) {
  const alivePlayers = players.filter(p => p.alive);
  if (alivePlayers.length === 0) return;

  switch (event.id) {
    case 'reorg': {
      // Kill one random alive player
      const victim = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      victim.alive = false;
      victim.hp = 0;
      sound.playDeath();
      renderer.addFloatingText(victim.x, victim.y - 20, 'LAID OFF', '#ff4444', 2);
      renderer.addScreenShake(5, 0.3);
      break;
    }
    case 'new_teams': {
      // Promote 20% of alive upgradeable enemies
      const upgradeable = enemies.filter(e =>
        e.alive && ['jira', 'bug', 'feature', 'pm', 'em', 'vp'].includes(e.type)
      );
      const count = Math.max(1, Math.floor(upgradeable.length * 0.2));
      // Shuffle and pick
      for (let i = upgradeable.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [upgradeable[i], upgradeable[j]] = [upgradeable[j], upgradeable[i]];
      }
      for (let i = 0; i < Math.min(count, upgradeable.length); i++) {
        upgradeEnemyType(upgradeable[i]);
        renderer.addFloatingText(upgradeable[i].x, upgradeable[i].y - 10, 'PROMOTED', '#ffcc44', 1.5);
      }
      break;
    }
    case 'we_need_ai': {
      // Spawn 10 mini AI enemies around players, bypassing enemy cap
      let cx = 0, cy = 0;
      for (const p of alivePlayers) { cx += p.x; cy += p.y; }
      cx /= alivePlayers.length;
      cy /= alivePlayers.length;
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const dist = 250 + Math.random() * 150;
        enemies.push(new Enemy('ai_mini', cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, waveManager.currentWave));
      }
      break;
    }
    case 'micromanager': {
      // Revert up to 2 random upgrades (excluding new_weapon)
      const revertible = globalEventManager.upgradeHistory.filter(id => id !== 'new_weapon');
      if (revertible.length === 0) break;
      // Pick up to 2 unique
      const unique = [...new Set(revertible)];
      for (let i = unique.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unique[i], unique[j]] = [unique[j], unique[i]];
      }
      const toRevert = unique.slice(0, 2);
      for (const id of toRevert) {
        // Remove first occurrence from history
        const idx = globalEventManager.upgradeHistory.indexOf(id);
        if (idx !== -1) globalEventManager.upgradeHistory.splice(idx, 1);
        revertUpgradeFromAll(alivePlayers, id);
        renderer.addFloatingText(
          alivePlayers[0].x, alivePlayers[0].y - 30,
          `${id} DOWNGRADED`, '#ff8844', 2
        );
      }
      break;
    }
    case 'stakeholders': {
      // Remove 1 random weapon from each alive player (protect code_review)
      for (const p of alivePlayers) {
        const removable = p.weapons.filter(w => w.type !== 'code_review');
        if (removable.length === 0) continue;
        const victim = removable[Math.floor(Math.random() * removable.length)];
        p.weapons = p.weapons.filter(w => w !== victim);
        renderer.addFloatingText(p.x, p.y - 20, `-${victim.type}`, '#ff4444', 1.5);
      }
      break;
    }
  }
}

function triggerTeamLevelUp() {
  const options = rollUpgrades(3);
  votingState = { options, votes: new Map() };
  // Send to ALL controllers
  network.sendUpgradePromptToAll(options.map(o => ({
    id: o.id,
    name: o.name,
    desc: o.desc,
  })));

  // If debug player (keyboard, id=-1), auto-vote after 1s
  const debugPlayer = players.find(p => p.id === -1 && p.alive);
  if (debugPlayer) {
    setTimeout(() => {
      if (votingState && !votingState.votes.has(-1)) {
        votingState.votes.set(-1, options[0].id);
        const alivePlayers = players.filter(p => p.alive);
        if (votingState.votes.size >= alivePlayers.length) {
          resolveVote();
        }
      }
    }, 1000);
  }
}

function resolveVote() {
  if (!votingState) return;
  // Tally votes per upgradeId
  const tally = new Map();
  for (const [, uid] of votingState.votes) {
    tally.set(uid, (tally.get(uid) || 0) + 1);
  }
  // Find max vote count
  let maxCount = 0;
  for (const count of tally.values()) {
    if (count > maxCount) maxCount = count;
  }
  // Collect all tied at max
  const tied = [];
  for (const [uid, count] of tally) {
    if (count === maxCount) tied.push(uid);
  }
  // Random pick among ties
  const winnerId = tied[Math.floor(Math.random() * tied.length)];
  // Apply to all alive players
  const alivePlayers = players.filter(p => p.alive);
  applyUpgradeToAll(alivePlayers, winnerId);
  globalEventManager.recordUpgrade(winnerId);
  // Sync level
  for (const p of alivePlayers) {
    p.level = teamXP.level;
  }
  // Clear voting
  votingState = null;
  network.sendUpgradeResolved();
}

// --- Init ---
generateQRUrl();
requestAnimationFrame(gameLoop);
