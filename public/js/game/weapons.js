// Weapon definitions and auto-fire logic
import { Projectile } from './entities.js';

export const WEAPON_DEFS = {
  directional_shot: {
    name: 'Directional Shot',
    cooldown: 0.7,
    damage: 12,
    speed: 300,
    pierce: 1,
    progression: ['fire_rate', 'damage', 'pierce', 'multishot'],
    fire(player, projectiles) {
      const p = new Projectile(
        player.x, player.y,
        player.facingX * this.speed, player.facingY * this.speed,
        this.damage * player.damageMultiplier,
        this.pierce + (player.weaponBonuses?.directional_shot?.pierce || 0),
        'directional_shot', player.id
      );
      const multishot = player.weaponBonuses?.directional_shot?.multishot || 0;
      if (multishot > 0) {
        projectiles.push(p);
        const baseAngle = Math.atan2(player.facingY, player.facingX);
        for (let i = 0; i < multishot; i++) {
          const offset = (i + 1) * 0.2 * (i % 2 === 0 ? 1 : -1);
          const a = baseAngle + offset;
          projectiles.push(new Projectile(
            player.x, player.y,
            Math.cos(a) * this.speed, Math.sin(a) * this.speed,
            this.damage * player.damageMultiplier,
            this.pierce + (player.weaponBonuses?.directional_shot?.pierce || 0),
            'directional_shot', player.id
          ));
        }
      } else {
        projectiles.push(p);
      }
    },
  },

  four_projectiles: {
    name: '4 Projectiles',
    cooldown: 1.2,
    damage: 10,
    speed: 250,
    pierce: 0,
    progression: ['fire_rate', 'damage', 'pierce'],
    fire(player, projectiles) {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx, dy] of dirs) {
        projectiles.push(new Projectile(
          player.x, player.y,
          dx * this.speed, dy * this.speed,
          this.damage * player.damageMultiplier,
          this.pierce + (player.weaponBonuses?.four_projectiles?.pierce || 0),
          'four_projectiles', player.id
        ));
      }
    },
  },

  orbits: {
    name: 'Orbits',
    cooldown: 0.2,
    damage: 8,
    speed: 0,
    pierce: 999,
    progression: ['rotation_speed', 'damage'],
    fire(player, projectiles) {
      // Contact damage via orbit — handled in main.js collision check
      // This is a passive weapon, no projectile needed
    },
    isPassive: true,
    orbitRadius: 50,
    orbitDamage: 14,
  },

  minigun: {
    name: 'Minigun',
    cooldown: 0.2,
    damage: 2.5,
    speed: 400,
    pierce: 0,
    progression: ['damage', 'reduce_spread'],
    _baseSpread: 0.5,
    fire(player, projectiles) {
      const spreadReduction = player.weaponBonuses?.minigun?.reduce_spread || 0;
      const spread = Math.max(0.05, this._baseSpread - spreadReduction * 0.1);
      const angle = (Math.random() - 0.5) * spread;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const vx = player.facingX * this.speed;
      const vy = player.facingY * this.speed;
      projectiles.push(new Projectile(
        player.x, player.y,
        vx * cos - vy * sin,
        vx * sin + vy * cos,
        this.damage * player.damageMultiplier,
        0,
        'minigun', player.id
      ));
    },
  },

  lightning: {
    name: 'Lightning',
    cooldown: 1.5,
    damage: 18,
    speed: 0,
    pierce: 999,
    progression: ['extra_strike', 'reduce_cooldown'],
    fire(player, projectiles) {
      const strikes = 1 + (player.weaponBonuses?.lightning?.extra_strike || 0);
      for (let i = 0; i < strikes; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 40;
        const px = player.x + Math.cos(angle) * dist;
        const py = player.y + Math.sin(angle) * dist;
        const p = new Projectile(
          px, py, 0, 0,
          this.damage * player.damageMultiplier,
          999, 'lightning', player.id, 40
        );
        p.lifetime = 0.3;
        p.isAOE = true;
        p.isLightning = true;
        projectiles.push(p);
      }
    },
  },

  laser_eyes: {
    name: 'Laser Eyes',
    cooldown: 1.0,
    damage: 15,
    speed: 0,
    pierce: 999,
    progression: ['laser_length', 'damage'],
    isPassive: true,
    beamLength: 150,
    beamDamage: 5,
    beamHitInterval: 0.3,
    beamOnDuration: 1.0,
    beamOffDuration: 1.0,
    fire(player, projectiles) {
      // Continuous beam — handled in main.js collision check
    },
  },

  octopus_hands: {
    name: 'Octopus Hands',
    cooldown: 1.0,
    damage: 8,
    speed: 150,
    pierce: 0,
    progression: ['fire_rate', 'damage'],
    fire(player, projectiles) {
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const p = new Projectile(
          player.x, player.y,
          Math.cos(angle) * this.speed, Math.sin(angle) * this.speed,
          this.damage * player.damageMultiplier,
          0,
          'octopus_hands', player.id
        );
        p.lifetime = 0.3;
        p.isTentacle = true;
        p.tentacleSeed = Math.random() * 100;
        projectiles.push(p);
      }
    },
  },

  guided_missile: {
    name: 'Guided Missile',
    cooldown: 2,
    damage: 30,
    speed: 120,
    pierce: 0,
    progression: ['fire_rate', 'damage', 'multishot'],
    fire(player, projectiles) {
      const count = 1 + (player.weaponBonuses?.guided_missile?.multishot || 0);
      for (let i = 0; i < count; i++) {
        const spreadAngle = count > 1 ? (i - (count - 1) / 2) * 0.3 : 0;
        const baseAngle = Math.atan2(player.facingY, player.facingX) + spreadAngle;
        projectiles.push(new Projectile(
          player.x, player.y,
          Math.cos(baseAngle) * this.speed, Math.sin(baseAngle) * this.speed,
          this.damage * player.damageMultiplier,
          0,
          'guided_missile', player.id
        ));
      }
    },
  },

  shotgun: {
    name: 'Shotgun',
    cooldown: 1.8,
    damage: 18,
    speed: 350,
    pierce: 0,
    progression: ['fire_rate', 'distance', 'pierce'],
    fire(player, projectiles) {
      const pellets = 6;
      const spreadAngle = 0.8;
      const baseAngle = Math.atan2(player.facingY, player.facingX);
      const distBonus = player.weaponBonuses?.shotgun?.distance || 0;
      const lifetime = 0.4 + distBonus * 0.15;
      const pierceBonus = player.weaponBonuses?.shotgun?.pierce || 0;
      for (let i = 0; i < pellets; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * spreadAngle;
        const p = new Projectile(
          player.x, player.y,
          Math.cos(angle) * this.speed, Math.sin(angle) * this.speed,
          this.damage * player.damageMultiplier,
          pierceBonus,
          'shotgun', player.id
        );
        p.lifetime = lifetime;
        projectiles.push(p);
      }
    },
  },
};

// Apply a weapon-specific progression upgrade
export function applyProgression(player, weaponType, progressionId) {
  if (!player.weaponBonuses) player.weaponBonuses = {};
  if (!player.weaponBonuses[weaponType]) player.weaponBonuses[weaponType] = {};
  const bonuses = player.weaponBonuses[weaponType];

  switch (progressionId) {
    case 'fire_rate':
      bonuses.fire_rate = (bonuses.fire_rate || 0) + 1;
      break;
    case 'damage':
      bonuses.damage = (bonuses.damage || 0) + 1;
      break;
    case 'pierce':
      bonuses.pierce = (bonuses.pierce || 0) + 1;
      break;
    case 'multishot':
      bonuses.multishot = (bonuses.multishot || 0) + 1;
      break;
    case 'rotation_speed':
      bonuses.rotation_speed = (bonuses.rotation_speed || 0) + 1;
      break;
    case 'reduce_spread':
      bonuses.reduce_spread = (bonuses.reduce_spread || 0) + 1;
      break;
    case 'extra_strike':
      bonuses.extra_strike = (bonuses.extra_strike || 0) + 1;
      break;
    case 'reduce_cooldown':
      bonuses.reduce_cooldown = (bonuses.reduce_cooldown || 0) + 1;
      break;
    case 'laser_length':
      bonuses.laser_length = (bonuses.laser_length || 0) + 1;
      break;
    case 'distance':
      bonuses.distance = (bonuses.distance || 0) + 1;
      break;
  }
}

// Revert a weapon-specific progression upgrade
export function revertProgression(player, weaponType, progressionId) {
  if (!player.weaponBonuses?.[weaponType]) return;
  const bonuses = player.weaponBonuses[weaponType];
  if (bonuses[progressionId] !== undefined) {
    bonuses[progressionId] = Math.max(0, bonuses[progressionId] - 1);
  }
}

export function updateWeapons(dt, player, projectiles, enemies) {
  if (!player.alive) return;

  for (const w of player.weapons) {
    const def = WEAPON_DEFS[w.type];
    if (!def) continue;

    // Apply weapon-specific bonuses to effective stats
    const bonuses = player.weaponBonuses?.[w.type] || {};
    const fireRateBonus = 1 + (bonuses.fire_rate || 0) * 0.2;
    const damageBonus = 1 + (bonuses.damage || 0) * 0.15;
    const cooldownReduction = 1 + (bonuses.reduce_cooldown || 0) * 0.2;

    w.cooldown -= dt;
    if (w.cooldown <= 0) {
      const actualCooldown = def.cooldown / (player.fireRateMultiplier * fireRateBonus * cooldownReduction);
      w.cooldown = actualCooldown;
      if (!def.isPassive) {
        // Temporarily boost damage multiplier for this weapon's fire
        const origDamage = player.damageMultiplier;
        player.damageMultiplier *= damageBonus;
        def.fire(player, projectiles, enemies);
        player.damageMultiplier = origDamage;
      }
    }
  }
}
