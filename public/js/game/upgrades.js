// Upgrade pool — vague descriptions, no exact stats shown
import { WEAPON_DEFS, applyProgression, revertProgression } from './weapons.js';

const UPGRADES = [
  {
    id: 'improve_weapon',
    name: 'Improve Weapon',
    desc: 'Improve a weapon',
    _dynamic: true,
    apply(player) {
      if (player.weapons.length === 0) return;
      const w = player.weapons[Math.floor(Math.random() * player.weapons.length)];
      const def = WEAPON_DEFS[w.type];
      if (!def || !def.progression || def.progression.length === 0) return;
      const prog = def.progression[Math.floor(Math.random() * def.progression.length)];
      applyProgression(player, w.type, prog);
      // Store what was applied for revert
      if (!player._lastWeaponUpgrade) player._lastWeaponUpgrade = [];
      player._lastWeaponUpgrade.push({ weaponType: w.type, progressionId: prog });
    },
    revert(player) {
      if (!player._lastWeaponUpgrade || player._lastWeaponUpgrade.length === 0) return;
      const last = player._lastWeaponUpgrade.pop();
      if (last) revertProgression(player, last.weaponType, last.progressionId);
    },
  },
  {
    id: 'improve_health',
    name: 'Improve Health',
    desc: 'Increase max health',
    apply(player) {
      player.maxHp += 25;
      player.hp = player.maxHp;
    },
    revert(player) {
      player.maxHp = Math.max(100, player.maxHp - 25);
      player.hp = Math.min(player.hp, player.maxHp);
    },
  },
  {
    id: 'improve_speed',
    name: 'Improve Speed',
    desc: 'Move faster',
    apply(player) {
      player.speed *= 1.15;
    },
    revert(player) {
      player.speed = Math.max(150, player.speed / 1.15);
    },
  },
  {
    id: 'improve_pickup',
    name: 'Improve XP Collection',
    desc: 'Collect XP from further away',
    apply(player) {
      player.pickupRadius *= 1.5;
    },
    revert(player) {
      player.pickupRadius = Math.max(50, player.pickupRadius / 1.5);
    },
  },
  {
    id: 'new_weapon',
    name: 'New Weapon',
    desc: 'Learn a new weapon',
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
    revert: null,
  },
];

// Generic label for improve_weapon (applies randomly per-player, so no specific weapon shown)
function getDynamicUpgrade() {
  return {
    id: 'improve_weapon',
    name: 'Improve one of your weapons',
    desc: 'Improve one of your weapons',
  };
}

// Pick n random unique upgrades
export function rollUpgrades(n = 3) {
  const pool = UPGRADES.map(u => {
    if (u._dynamic) {
      const dynamic = getDynamicUpgrade();
      return { ...u, name: dynamic.name, desc: dynamic.desc };
    }
    return { ...u };
  });
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

export function applyUpgradeToAll(players, upgradeId) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) return;

  if (upgradeId === 'new_weapon') {
    // Pre-roll ONE random weapon, give the same weapon to all players
    const allOwned = new Set();
    for (const p of players) {
      for (const w of p.weapons) allOwned.add(w.type);
    }
    const available = Object.keys(WEAPON_DEFS).filter(k => !allOwned.has(k));
    if (available.length === 0) {
      // All weapons owned — boost damage for all
      for (const p of players) {
        p.damageMultiplier = (p.damageMultiplier || 1) + 0.2;
      }
      return;
    }
    const type = available[Math.floor(Math.random() * available.length)];
    for (const p of players) {
      if (!p.weapons.some(w => w.type === type)) {
        p.weapons.push({ type, cooldown: 0 });
      }
    }
  } else {
    for (const p of players) {
      upgrade.apply(p);
    }
  }
}

export function revertUpgradeFromAll(players, upgradeId) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade || !upgrade.revert) return;
  for (const p of players) {
    if (p.alive) upgrade.revert(p);
  }
}

export { UPGRADES };
