// Upgrade pool — sarcastic names, real effects
import { WEAPON_DEFS } from './weapons.js';

const UPGRADES = [
  {
    id: 'new_weapon',
    name: '"Learn a new framework"',
    desc: 'Add a random weapon',
    apply(player) {
      const owned = new Set(player.weapons.map(w => w.type));
      const available = Object.keys(WEAPON_DEFS).filter(k => !owned.has(k));
      if (available.length === 0) {
        // All weapons owned — boost damage instead
        player.damageMultiplier = (player.damageMultiplier || 1) + 0.2;
        return;
      }
      const type = available[Math.floor(Math.random() * available.length)];
      player.weapons.push({ type, cooldown: 0 });
    },
  },
  {
    id: 'damage',
    name: '"Senior engineer review"',
    desc: '+20% damage',
    apply(player) {
      player.damageMultiplier = (player.damageMultiplier || 1) + 0.2;
    },
  },
  {
    id: 'speed',
    name: '"Agile methodology"',
    desc: '+15% move speed',
    apply(player) {
      player.speed *= 1.15;
    },
  },
  {
    id: 'hp',
    name: '"Work-life balance"',
    desc: '+25 max HP, full heal',
    apply(player) {
      player.maxHp += 25;
      player.hp = player.maxHp;
    },
  },
  {
    id: 'fire_rate',
    name: '"Caffeinated"',
    desc: '+20% fire rate',
    apply(player) {
      player.fireRateMultiplier = (player.fireRateMultiplier || 1) + 0.2;
    },
  },
  {
    id: 'pickup',
    name: '"Networking skills"',
    desc: '+50% pickup radius',
    apply(player) {
      player.pickupRadius *= 1.5;
    },
  },
  {
    id: 'pierce',
    name: '"Vertical slice"',
    desc: '+1 pierce on projectiles',
    apply(player) {
      player.bonusPierce = (player.bonusPierce || 0) + 1;
    },
  },
  {
    id: 'aoe',
    name: '"Scope creep"',
    desc: '+25% AOE size',
    apply(player) {
      player.aoeMultiplier = (player.aoeMultiplier || 1) + 0.25;
    },
  },
];

// Pick n random unique upgrades
export function rollUpgrades(n = 3) {
  const pool = [...UPGRADES];
  const picks = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

export function applyUpgrade(player, upgradeId) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (upgrade) upgrade.apply(player);
}

export { UPGRADES };
