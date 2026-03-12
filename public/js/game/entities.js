// Entity classes — Player, Enemy, Projectile, XPGem
import { GAME_CONFIG } from './config.js';

const DEATH_MESSAGES = [
  'Mass-laid-off',
  'PR rejected by the universe',
  'Stack overflow (literally)',
  'Segfault in production',
  'Replaced by a shell script',
  'Lost in a rebase',
  'Deleted by rm -rf',
  'Timed out in standup',
];

export class Player {
  constructor(id, characterInfo) {
    this.id = id;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.dx = 0; // joystick input
    this.dy = 0;
    this.facingX = 1; // last non-zero direction
    this.facingY = 0;
    this.speed = 150;
    this.radius = 14;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.characterId = characterInfo ? characterInfo.id : null;
    this.color = characterInfo ? characterInfo.color : '#ff4466';
    this.name = characterInfo ? characterInfo.name : 'Player';
    this.avatar = characterInfo ? characterInfo.avatar : null;
    this.level = 1;
    this.weapons = [{ type: 'code_review', cooldown: 0 }];
    this.damageMultiplier = 1;
    this.fireRateMultiplier = 1;
    this.pickupRadius = 50;
    this.bonusPierce = 0;
    this.aoeMultiplier = 1;
    this.projectileCount = 1;
    this.invincibleTimer = 0;
    this.kills = 0;
    // Weapon-specific state
    this.rubberDuckAngle = 0;
    this.coffeeActive = false;
  }

  update(dt) {
    if (!this.alive) return;
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

    // Normalize and apply movement
    const len = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
    if (len > 0.1) {
      this.vx = (this.dx / len) * this.speed;
      this.vy = (this.dy / len) * this.speed;
      this.facingX = this.dx / len;
      this.facingY = this.dy / len;
    } else {
      this.vx = 0;
      this.vy = 0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Rubber duck orbit
    this.rubberDuckAngle += dt * 3;
  }

  takeDamage(amount) {
    if (!this.alive || this.invincibleTimer > 0) return false;
    this.hp -= amount;
    this.invincibleTimer = 0.3; // brief i-frames
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true; // died
    }
    return false;
  }

  getDeathMessage() {
    return DEATH_MESSAGES[this.id % DEATH_MESSAGES.length];
  }
}

export class Enemy {
  constructor(type, x, y, wave) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 14;
    this.alive = true;
    this.flash = 0; // hit flash timer
    this.wave = wave;

    // Flaky test teleport timer
    this.teleportTimer = 2;
    // Bug zigzag
    this.zigzagTimer = 0;
    this.zigzagDir = 1;
    // PM spawn timer
    this.spawnTimer = 5;
    // EM pull timer
    this.pullTimer = 0;
    // VP shuffle timer
    this.shuffleTimer = 8;
    // Boss phase
    this.phase = 1;
    this.phaseTimer = 0;
    this.hallucinationTimer = 0;

    // Set stats by type
    const scale = 1 + (wave - 1) * 0.05; // slight scaling with wave
    const cfg = GAME_CONFIG.enemyHp;
    switch (type) {
      case 'jira':
        this.hp = (cfg.jira ?? 15) * scale;
        this.maxHp = this.hp;
        this.speed = 60;
        this.damage = 8;
        this.xpValue = 3;
        break;
      case 'bug':
        this.hp = (cfg.bug ?? 10) * scale;
        this.maxHp = this.hp;
        this.speed = 110;
        this.damage = 6;
        this.xpValue = 3;
        break;
      case 'feature':
        this.hp = 40 * scale;
        this.maxHp = this.hp;
        this.speed = 40;
        this.damage = 12;
        this.xpValue = 8;
        this.radius = 18;
        break;
      case 'merge':
        this.hp = 80 * scale;
        this.maxHp = this.hp;
        this.speed = 30;
        this.damage = 15;
        this.xpValue = 12;
        this.radius = 20;
        break;
      case 'flaky':
        this.hp = 12 * scale;
        this.maxHp = this.hp;
        this.speed = 50;
        this.damage = 5;
        this.xpValue = 5;
        break;
      case 'pm':
        this.hp = (cfg.pm ?? 150) * scale;
        this.maxHp = this.hp;
        this.speed = 35;
        this.damage = 10;
        this.xpValue = 25;
        this.radius = 22;
        break;
      case 'em':
        this.hp = (cfg.em ?? 200) * scale;
        this.maxHp = this.hp;
        this.speed = 30;
        this.damage = 10;
        this.xpValue = 30;
        this.radius = 22;
        break;
      case 'vp':
        this.hp = (cfg.vp ?? 300) * scale;
        this.maxHp = this.hp;
        this.speed = 25;
        this.damage = 15;
        this.xpValue = 50;
        this.radius = 24;
        break;
      case 'ceo':
        this.hp = (cfg.ceo ?? 600) * scale;
        this.maxHp = this.hp;
        this.speed = 20;
        this.damage = 20;
        this.xpValue = 80;
        this.radius = 26;
        break;
      case 'ai_mini':
        this.hp = Math.max(1, Math.floor((cfg.boss ?? 2000) * 0.1));
        this.maxHp = this.hp;
        this.speed = 55;
        this.damage = 12;
        this.xpValue = 15;
        this.radius = 18;
        break;
      case 'boss':
        this.hp = (cfg.boss ?? 2000) + wave * 100;
        this.maxHp = this.hp;
        this.speed = 20;
        this.damage = 20;
        this.xpValue = 200;
        this.radius = 40;
        break;
      default:
        this.hp = 20;
        this.maxHp = 20;
        this.speed = 50;
        this.damage = 10;
        this.xpValue = 3;
    }
  }

  update(dt, players, enemies, spawnEnemy) {
    if (!this.alive) return;
    if (this.flash > 0) this.flash -= dt;

    // Find nearest alive player
    let nearest = null;
    let nearDist = Infinity;
    for (const p of players) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < nearDist) {
        nearDist = d;
        nearest = p;
      }
    }
    if (!nearest) return;

    // Type-specific AI
    switch (this.type) {
      case 'bug':
        this.zigzagTimer -= dt;
        if (this.zigzagTimer <= 0) {
          this.zigzagDir *= -1;
          this.zigzagTimer = 0.3;
        }
        this._moveToward(nearest, dt, this.zigzagDir);
        break;

      case 'flaky':
        this.teleportTimer -= dt;
        if (this.teleportTimer <= 0) {
          this.teleportTimer = 2;
          // Teleport to random position near a player
          const angle = Math.random() * Math.PI * 2;
          const dist = 100 + Math.random() * 200;
          this.x = nearest.x + Math.cos(angle) * dist;
          this.y = nearest.y + Math.sin(angle) * dist;
        }
        this._moveToward(nearest, dt);
        break;

      case 'pm':
        this._moveToward(nearest, dt);
        // Spawn JIRA tickets periodically
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && spawnEnemy) {
          this.spawnTimer = 4;
          const angle = Math.random() * Math.PI * 2;
          spawnEnemy('jira', this.x + Math.cos(angle) * 30, this.y + Math.sin(angle) * 30);
        }
        break;

      case 'em':
        this._moveToward(nearest, dt);
        break;

      case 'vp':
        this._moveToward(nearest, dt);
        // Spawn process minions
        this.shuffleTimer -= dt;
        if (this.shuffleTimer <= 0) {
          this.shuffleTimer = 10;
          if (spawnEnemy) {
            for (let i = 0; i < 3; i++) {
              const angle = (Math.PI * 2 / 3) * i;
              spawnEnemy('jira', this.x + Math.cos(angle) * 40, this.y + Math.sin(angle) * 40);
            }
          }
        }
        break;

      case 'ceo':
        this._moveToward(nearest, dt);
        // Spawn PM minions periodically
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && spawnEnemy) {
          this.spawnTimer = 6;
          for (let i = 0; i < 2; i++) {
            const angle = (Math.PI * 2 / 2) * i;
            spawnEnemy('pm', this.x + Math.cos(angle) * 50, this.y + Math.sin(angle) * 50);
          }
        }
        break;

      case 'boss':
        this._moveToward(nearest, dt);
        this._bossAI(dt, players, spawnEnemy, enemies);
        break;

      case 'feature':
      default:
        this._moveToward(nearest, dt);
        break;
    }
  }

  _moveToward(target, dt, perpMul = 0) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    let mx = dx / len;
    let my = dy / len;
    if (perpMul) {
      mx += (-my) * perpMul * 0.5;
      my += mx * perpMul * 0.5;
      const mlen = Math.hypot(mx, my) || 1;
      mx /= mlen;
      my /= mlen;
    }
    this.vx = mx * this.speed;
    this.vy = my * this.speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  _bossAI(dt, players, spawnEnemy, enemies) {
    this.phaseTimer += dt;
    const hpPct = this.hp / this.maxHp;

    if (hpPct < 0.33 && this.phase < 3) {
      this.phase = 3;
      this.phaseTimer = 0;
      // Phase 3: speed up and spawn swarm (no position manipulation)
    } else if (hpPct < 0.66 && this.phase < 2) {
      this.phase = 2;
      this.phaseTimer = 0;
    }

    switch (this.phase) {
      case 1:
        // Spawn clones periodically
        if (this.phaseTimer > 4 && spawnEnemy) {
          this.phaseTimer = 0;
          spawnEnemy('jira', this.x + 60, this.y);
          spawnEnemy('bug', this.x - 60, this.y);
          spawnEnemy('jira', this.x, this.y + 60);
        }
        break;
      case 2:
        // Hallucination — spawn lots of weak enemies
        this.hallucinationTimer -= dt;
        if (this.hallucinationTimer <= 0 && spawnEnemy) {
          this.hallucinationTimer = 1.5;
          for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 100 + Math.random() * 200;
            spawnEnemy('flaky', this.x + Math.cos(angle) * dist, this.y + Math.sin(angle) * dist);
          }
        }
        break;
      case 3:
        // Continuous swarm + faster
        this.speed = 35;
        this.hallucinationTimer -= dt;
        if (this.hallucinationTimer <= 0 && spawnEnemy) {
          this.hallucinationTimer = 2;
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            spawnEnemy('bug', this.x + Math.cos(angle) * 80, this.y + Math.sin(angle) * 80);
          }
        }
        break;
    }
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flash = 0.1;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }
}

export class Projectile {
  constructor(x, y, vx, vy, damage, pierce, type, ownerId, aoe = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.pierce = pierce;
    this.type = type;
    this.ownerId = ownerId;
    this.aoe = aoe; // 0 = no aoe, >0 = radius
    this.alive = true;
    this.lifetime = 3; // seconds
    this.hitEnemies = new Set();
    this.radius = 5;
    // Homing
    this.homing = type === 'hotfix';
  }

  update(dt, enemies) {
    if (!this.alive) return;
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.alive = false;
      return;
    }

    // Homing behavior
    if (this.homing) {
      let nearest = null;
      let nearDist = Infinity;
      for (const e of enemies) {
        if (!e.alive || this.hitEnemies.has(e)) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < nearDist) {
          nearDist = d;
          nearest = e;
        }
      }
      if (nearest && nearDist < 400) {
        const dx = nearest.x - this.x;
        const dy = nearest.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const turnSpeed = 3;
        this.vx += (dx / len) * turnSpeed;
        this.vy += (dy / len) * turnSpeed;
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 0) {
          this.vx = (this.vx / speed) * 120;
          this.vy = (this.vy / speed) * 120;
        }
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  hitEnemy(enemy) {
    if (this.hitEnemies.has(enemy)) return false;
    this.hitEnemies.add(enemy);
    this.pierce--;
    if (this.pierce < 0) this.alive = false;
    return true;
  }
}

export class XPGem {
  constructor(x, y, value = 1) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.alive = true;
    this.radius = 6;
    this.magnetSpeed = 0;
  }

  update(dt, players) {
    if (!this.alive) return;
    // Find nearest alive player within pickup radius
    let nearest = null;
    let nearDist = Infinity;
    for (const p of players) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < p.pickupRadius) {
        if (d < nearDist) {
          nearDist = d;
          nearest = p;
        }
      }
    }
    if (nearest) {
      // Magnet toward player
      this.magnetSpeed = Math.min(this.magnetSpeed + 600 * dt, 400);
      const dx = nearest.x - this.x;
      const dy = nearest.y - this.y;
      const len = Math.hypot(dx, dy) || 1;
      this.x += (dx / len) * this.magnetSpeed * dt;
      this.y += (dy / len) * this.magnetSpeed * dt;

      // Collect
      if (len < nearest.radius + this.radius) {
        this.alive = false;
        return nearest;
      }
    }
    return null;
  }
}

export class Ally {
  constructor(characterId, startX, startY, endX, endY) {
    this.characterId = characterId;
    this.x = startX;
    this.y = startY;
    this.radius = 40; // boss size
    this.damage = 5;
    this.alive = true;
    // Compute straight-line velocity
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 150;
    this.vx = (dx / len) * speed;
    this.vy = (dy / len) * speed;
    this.hitCooldowns = new Map(); // enemy -> timer
  }

  update(dt, enemies) {
    if (!this.alive) return [];
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Decrement cooldowns
    for (const [enemy, timer] of this.hitCooldowns) {
      const newTimer = timer - dt;
      if (newTimer <= 0) this.hitCooldowns.delete(enemy);
      else this.hitCooldowns.set(enemy, newTimer);
    }

    // Damage enemies on contact
    const killed = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      if (this.hitCooldowns.has(e)) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < e.radius + this.radius) {
        this.hitCooldowns.set(e, 0.5);
        const wasKilled = e.takeDamage(this.damage);
        if (wasKilled) killed.push(e);
      }
    }
    return killed;
  }
}

const PROMOTION_HIERARCHY = ['jira', 'bug', 'feature', 'pm', 'em', 'vp', 'ceo'];

export function upgradeEnemyType(enemy) {
  const idx = PROMOTION_HIERARCHY.indexOf(enemy.type);
  if (idx < 0 || idx >= PROMOTION_HIERARCHY.length - 1) return;
  const newType = PROMOTION_HIERARCHY[idx + 1];
  enemy.type = newType;

  const scale = 1 + (enemy.wave - 1) * 0.05;
  const cfg = GAME_CONFIG.enemyHp;
  switch (newType) {
    case 'bug':
      enemy.hp = (cfg.bug ?? 10) * scale;
      enemy.maxHp = enemy.hp;
      enemy.speed = 110;
      enemy.damage = 6;
      enemy.xpValue = 3;
      enemy.radius = 14;
      break;
    case 'feature':
      enemy.hp = 40 * scale;
      enemy.maxHp = enemy.hp;
      enemy.speed = 40;
      enemy.damage = 12;
      enemy.xpValue = 8;
      enemy.radius = 18;
      break;
    case 'pm':
      enemy.hp = (cfg.pm ?? 150) * scale;
      enemy.maxHp = enemy.hp;
      enemy.speed = 35;
      enemy.damage = 10;
      enemy.xpValue = 25;
      enemy.radius = 22;
      break;
    case 'em':
      enemy.hp = (cfg.em ?? 200) * scale;
      enemy.maxHp = enemy.hp;
      enemy.speed = 30;
      enemy.damage = 10;
      enemy.xpValue = 30;
      enemy.radius = 22;
      break;
    case 'vp':
      enemy.hp = (cfg.vp ?? 300) * scale;
      enemy.maxHp = enemy.hp;
      enemy.speed = 25;
      enemy.damage = 15;
      enemy.xpValue = 50;
      enemy.radius = 24;
      break;
    case 'ceo':
      enemy.hp = (cfg.ceo ?? 600) * scale;
      enemy.maxHp = enemy.hp;
      enemy.speed = 20;
      enemy.damage = 20;
      enemy.xpValue = 80;
      enemy.radius = 26;
      break;
  }
}
