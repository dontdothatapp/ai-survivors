// Wave spawning & progression
import { Enemy } from './entities.js';
import { GAME_CONFIG } from './config.js';

const WAVE_DURATION = 45; // seconds per sprint
const MAX_ENEMIES = 40;

const SPRINT_NEW_ENEMY = {
  1: { type: 'jira', name: 'Jira Ticket' },
  2: { type: 'bug',  name: 'Bug Report' },
  3: { type: 'pm',   name: 'Product Manager' },
  4: { type: 'em',   name: 'Engineering Manager' },
  5: { type: 'vp',   name: 'VP of Engineering' },
  6: { type: 'ceo',  name: 'CEO' },
  7: { type: 'boss', name: 'THE AI' },
};

const WAVE_MESSAGES = [
  'Sprint 1 begins... The backlog grows.',
  'Sprint 2... The bugs are multiplying.',
  'Sprint 3... A wild Product Manager appears!',
  'Sprint 4... The Engineering Manager wants a word.',
  'Sprint 5... The VP has "ideas".',
  'Sprint 6... The CEO has entered the building.',
  'FINAL SPRINT... THE AI HAS AWAKENED.',
];

export class WaveManager {
  constructor() {
    this.currentWave = 0;
    this.waveTimer = 3; // 3 second initial delay
    this.spawnTimer = 0;
    this.active = false;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.totalKills = 0;
    this.sprintKills = 0;
    this.waveMessage = '';
    this.waveMessageTimer = 0;
    this.sprintPauseActive = false;
    this.sprintPauseTimer = 0;
    this.newEnemy = null;
  }

  start() {
    this.active = true;
    this.waveTimer = 3;
    this.currentWave = 0;
  }

  update(dt, enemies, players, arenaWidth, arenaHeight) {
    if (!this.active) return;

    // Sprint pause countdown — block all wave logic
    if (this.sprintPauseActive) {
      this.sprintPauseTimer -= dt;
      if (this.sprintPauseTimer <= 0) {
        this.sprintPauseActive = false;
        this.waveMessageTimer = 0; // already shown in overlay, don't repeat via HTML
      }
      return;
    }

    this.waveTimer -= dt;
    if (this.waveMessageTimer > 0) this.waveMessageTimer -= dt;

    // Kills-based sprint advancement
    const killThreshold = GAME_CONFIG.killsPerSprint;
    if (killThreshold > 0 && this.sprintKills >= killThreshold && this.currentWave > 0 && this.currentWave < 7) {
      this.waveTimer = 0;
    }

    // Check boss defeated
    if (this.bossSpawned && !this.bossDefeated) {
      const boss = enemies.find(e => e.type === 'boss');
      if (boss && !boss.alive) {
        this.bossDefeated = true;
      }
    }

    // Next wave
    if (this.waveTimer <= 0 && this.currentWave < 7) {
      this.sprintKills = 0;
      this.currentWave++;
      this.waveTimer = WAVE_DURATION;
      this.spawnTimer = 0;
      this.waveMessage = WAVE_MESSAGES[this.currentWave - 1] || `Sprint ${this.currentWave}...`;
      this.waveMessageTimer = 3;
      this.newEnemy = SPRINT_NEW_ENEMY[this.currentWave] || null;
      this.sprintPauseActive = true;
      this.sprintPauseTimer = 5;
    }

    if (this.currentWave === 0) return;

    // Spawn enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawnWaveEnemies(enemies, players, arenaWidth, arenaHeight);
      // Spawn rate increases with wave
      this.spawnTimer = Math.max(0.8, 3 - this.currentWave * 0.25);
    }
  }

  _spawnWaveEnemies(enemies, players, aw, ah) {
    const wave = this.currentWave;

    const aliveCount = enemies.filter(e => e.alive).length;

    // Boss wave — spawn boss once, then spawn elite escorts each interval
    if (wave >= 7) {
      if (!this.bossSpawned) {
        this.bossSpawned = true;
        const pos = this._spawnPosition(players, aw, ah);
        enemies.push(new Enemy('boss', pos.x, pos.y, wave));
      }
      if (aliveCount >= MAX_ENEMIES) return;
      // Spawn a small escort group alongside the boss
      const escortPool = ['vp', 'vp', 'em', 'em', 'pm'];
      const escortCount = 1 + Math.floor(Math.random() * 2); // 1–2 escorts
      for (let i = 0; i < escortCount; i++) {
        const type = escortPool[Math.floor(Math.random() * escortPool.length)];
        const pos = this._spawnPosition(players, aw, ah);
        enemies.push(new Enemy(type, pos.x, pos.y, wave));
      }
      return;
    }

    if (aliveCount >= MAX_ENEMIES) return;

    const count = Math.min(1 + wave, 6);
    for (let i = 0; i < count; i++) {
      const type = this._pickEnemyType(wave);
      if (!type) continue;
      const pos = this._spawnPosition(players, aw, ah);
      enemies.push(new Enemy(type, pos.x, pos.y, wave));
    }
  }

  _pickEnemyType(wave) {
    // Each sprint's "new" enemy type dominates; earlier types taper off
    const weights = {
      1: { jira: 10 },
      2: { jira: 3, bug: 7 },
      3: { jira: 1, bug: 3, pm: 6 },
      4: { bug: 1, pm: 3, em: 6 },
      5: { pm: 1, em: 3, vp: 6 },
      6: { em: 1, vp: 3, ceo: 6 },
    };
    const w = weights[wave] || weights[6];
    const pool = [];
    for (const [type, count] of Object.entries(w)) {
      for (let i = 0; i < count; i++) pool.push(type);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _spawnPosition(players, aw, ah) {
    // Spawn off-screen relative to player centroid
    let cx = 0, cy = 0, count = 0;
    for (const p of players) {
      if (p.alive) { cx += p.x; cy += p.y; count++; }
    }
    if (count > 0) { cx /= count; cy /= count; }

    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 200;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    };
  }
}
