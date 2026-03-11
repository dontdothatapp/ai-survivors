// Wave spawning & progression
import { Enemy } from './entities.js';

const WAVE_DURATION = 30; // seconds per wave

const WAVE_MESSAGES = [
  'Sprint 1 begins... The backlog grows.',
  'Sprint 2... "Can we just add one more thing?"',
  'Sprint 3... The bugs are multiplying.',
  'Sprint 4... Something feels off about this codebase.',
  'Sprint 5... A wild Product Manager appears!',
  'Sprint 6... The stand-ups are getting longer.',
  'Sprint 7... "We need to pivot."',
  'Sprint 8... Merge conflicts everywhere!',
  'Sprint 9... The CI pipeline is on fire.',
  'Sprint 10... "Let\'s rewrite it in Rust."',
  'Sprint 11... The tech debt is sentient now.',
  'Sprint 12... The VP has "ideas".',
  'Sprint 13... "Can we make it more AI-powered?"',
  'Sprint 14... The codebase has achieved consciousness.',
  'Sprint 15... All hands meeting. It\'s bad.',
  'Sprint 16... "We\'re pivoting to AI."',
  'Sprint 17... The servers are burning.',
  'Sprint 18... "Ship it, we\'ll fix it later."',
  'Sprint 19... The calm before the storm.',
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
    this.waveMessage = '';
    this.waveMessageTimer = 0;
  }

  start() {
    this.active = true;
    this.waveTimer = 3;
    this.currentWave = 0;
  }

  update(dt, enemies, players, arenaWidth, arenaHeight) {
    if (!this.active) return;

    this.waveTimer -= dt;
    if (this.waveMessageTimer > 0) this.waveMessageTimer -= dt;

    // Check boss defeated
    if (this.bossSpawned && !this.bossDefeated) {
      const boss = enemies.find(e => e.type === 'boss');
      if (boss && !boss.alive) {
        this.bossDefeated = true;
      }
    }

    // Next wave
    if (this.waveTimer <= 0 && this.currentWave < 20) {
      this.currentWave++;
      this.waveTimer = WAVE_DURATION;
      this.spawnTimer = 0;
      this.waveMessage = WAVE_MESSAGES[this.currentWave - 1] || `Sprint ${this.currentWave}...`;
      this.waveMessageTimer = 3;
    }

    if (this.currentWave === 0) return;

    // Spawn enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawnWaveEnemies(enemies, players, arenaWidth, arenaHeight);
      // Spawn rate increases with wave
      this.spawnTimer = Math.max(0.5, 3 - this.currentWave * 0.12);
    }
  }

  _spawnWaveEnemies(enemies, players, aw, ah) {
    const wave = this.currentWave;
    const count = Math.min(2 + Math.floor(wave / 2), 8);

    for (let i = 0; i < count; i++) {
      const type = this._pickEnemyType(wave);
      if (!type) continue;
      const pos = this._spawnPosition(players, aw, ah);
      enemies.push(new Enemy(type, pos.x, pos.y, wave));
    }

    // Elite spawns
    if (wave === 5 || (wave > 5 && wave % 4 === 1)) {
      const pos = this._spawnPosition(players, aw, ah);
      enemies.push(new Enemy('pm', pos.x, pos.y, wave));
    }
    if (wave === 8 || (wave > 8 && wave % 4 === 0)) {
      const pos = this._spawnPosition(players, aw, ah);
      enemies.push(new Enemy('em', pos.x, pos.y, wave));
    }
    if (wave === 12 || (wave > 12 && wave % 5 === 2)) {
      const pos = this._spawnPosition(players, aw, ah);
      enemies.push(new Enemy('vp', pos.x, pos.y, wave));
    }

    // Boss on wave 20
    if (wave >= 20 && !this.bossSpawned) {
      this.bossSpawned = true;
      const pos = this._spawnPosition(players, aw, ah);
      enemies.push(new Enemy('boss', pos.x, pos.y, wave));
    }
  }

  _pickEnemyType(wave) {
    const pool = ['jira'];
    if (wave >= 4) pool.push('bug');
    if (wave >= 5) pool.push('feature');
    if (wave >= 8) pool.push('merge');
    if (wave >= 12) pool.push('flaky');

    // Weight later types
    if (wave >= 15) {
      pool.push('bug', 'feature', 'merge', 'flaky');
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
