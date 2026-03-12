// Persistent game config — saved to localStorage, editable via admin panel

const DEFAULTS = {
  enemyHp: {
    jira: 15,
    bug: 10,
    pm: 150,
    em: 200,
    vp: 300,
    ceo: 600,
    boss: 2000,
  },
  enemyDamage: {
    jira: 8, bug: 6, feature: 12, merge: 15, flaky: 5,
    pm: 10, em: 10, vp: 15, ceo: 20, boss: 20,
  },
  sprintDuration: 45,  // seconds per sprint
  xpMultiplier: 1.5,   // each level-up requires this × more XP than the previous
};

const STORAGE_KEY = 'ai_survivors_config';

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        enemyHp: { ...DEFAULTS.enemyHp, ...(saved.enemyHp || {}) },
        enemyDamage: { ...DEFAULTS.enemyDamage, ...(saved.enemyDamage || {}) },
        sprintDuration: saved.sprintDuration ?? DEFAULTS.sprintDuration,
        xpMultiplier: saved.xpMultiplier ?? DEFAULTS.xpMultiplier,
      };
    }
  } catch (_) { /* ignore parse errors */ }
  return JSON.parse(JSON.stringify(DEFAULTS));
}

export const GAME_CONFIG = loadConfig();

export function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(GAME_CONFIG));
}

export function resetConfig() {
  const def = JSON.parse(JSON.stringify(DEFAULTS));
  Object.assign(GAME_CONFIG.enemyHp, def.enemyHp);
  Object.assign(GAME_CONFIG.enemyDamage, def.enemyDamage);
  GAME_CONFIG.sprintDuration = def.sprintDuration;
  GAME_CONFIG.xpMultiplier = def.xpMultiplier;
  localStorage.removeItem(STORAGE_KEY);
}
