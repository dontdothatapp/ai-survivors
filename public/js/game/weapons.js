// Weapon definitions and auto-fire logic
import { Projectile } from './entities.js';

export const WEAPON_DEFS = {
  code_review: {
    name: 'Code Review',
    cooldown: 0.5,
    damage: 12,
    speed: 300,
    pierce: 1,
    fire(player, projectiles) {
      const p = new Projectile(
        player.x, player.y,
        player.facingX * this.speed, player.facingY * this.speed,
        this.damage * player.damageMultiplier,
        this.pierce + player.bonusPierce,
        'code_review', player.id
      );
      projectiles.push(p);
    },
  },

  stackoverflow: {
    name: 'Stack Overflow',
    cooldown: 1.2,
    damage: 10,
    speed: 250,
    pierce: 0,
    fire(player, projectiles) {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx, dy] of dirs) {
        projectiles.push(new Projectile(
          player.x, player.y,
          dx * this.speed, dy * this.speed,
          this.damage * player.damageMultiplier,
          this.pierce + player.bonusPierce,
          'stackoverflow', player.id
        ));
      }
    },
  },

  git_revert: {
    name: 'Git Revert',
    cooldown: 3,
    damage: 25,
    speed: 0,
    pierce: 999,
    fire(player, projectiles) {
      // AOE pulse — create a short-lived expanding projectile
      const aoeRadius = 80 * player.aoeMultiplier;
      const p = new Projectile(
        player.x, player.y, 0, 0,
        this.damage * player.damageMultiplier,
        999, 'git_revert', player.id, aoeRadius
      );
      p.lifetime = 0.3;
      p.isAOE = true;
      projectiles.push(p);
    },
  },

  rubber_duck: {
    name: 'Rubber Duck',
    cooldown: 0.2,
    damage: 8,
    speed: 0,
    pierce: 999,
    fire(player, projectiles) {
      // Contact damage via orbit — handled in main.js collision check
      // This is a passive weapon, no projectile needed
    },
    // Special: orbit check done in main loop
    isPassive: true,
    orbitRadius: 50,
    orbitDamage: 8,
  },

  unit_test: {
    name: 'Unit Test',
    cooldown: 0.15,
    damage: 5,
    speed: 400,
    pierce: 0,
    fire(player, projectiles) {
      const spread = (Math.random() - 0.5) * 0.3;
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const vx = player.facingX * this.speed;
      const vy = player.facingY * this.speed;
      projectiles.push(new Projectile(
        player.x, player.y,
        vx * cos - vy * sin,
        vx * sin + vy * cos,
        this.damage * player.damageMultiplier,
        this.pierce + player.bonusPierce,
        'unit_test', player.id
      ));
    },
  },

  hotfix: {
    name: 'Hotfix',
    cooldown: 2,
    damage: 30,
    speed: 120,
    pierce: 0,
    fire(player, projectiles) {
      projectiles.push(new Projectile(
        player.x, player.y,
        player.facingX * this.speed, player.facingY * this.speed,
        this.damage * player.damageMultiplier,
        this.pierce + player.bonusPierce,
        'hotfix', player.id
      ));
    },
  },

  coffee: {
    name: 'Coffee',
    cooldown: 1,
    damage: 0,
    speed: 0,
    pierce: 0,
    isPassive: true,
    auraRadius: 120,
    fireRateBoost: 0.3,
    fire() {
      // Passive — boost applied in main loop
    },
  },

  standup: {
    name: 'Standup Meeting',
    cooldown: 8,
    damage: 0,
    speed: 0,
    pierce: 0,
    freezeRadius: 120,
    freezeDuration: 2,
    fire(player, projectiles, enemies) {
      const r = this.freezeRadius * player.aoeMultiplier;
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < r) {
          e.frozenTimer = this.freezeDuration;
        }
      }
    },
  },
};

export function updateWeapons(dt, player, projectiles, enemies) {
  if (!player.alive) return;

  // Coffee aura boost — check if any ally with coffee is nearby
  let coffeeBoost = 0;
  // (applied externally in main.js)

  for (const w of player.weapons) {
    const def = WEAPON_DEFS[w.type];
    if (!def) continue;

    w.cooldown -= dt;
    if (w.cooldown <= 0) {
      const actualCooldown = def.cooldown / player.fireRateMultiplier;
      w.cooldown = actualCooldown;
      if (!def.isPassive) {
        def.fire(player, projectiles, enemies);
      } else if (w.type === 'standup') {
        def.fire(player, projectiles, enemies);
      }
    }
  }
}
