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
  killsPerSprint: 0,   // 0 = disabled (time-based only)
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
        killsPerSprint: saved.killsPerSprint ?? DEFAULTS.killsPerSprint,
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
  GAME_CONFIG.killsPerSprint = def.killsPerSprint;
  GAME_CONFIG.xpMultiplier = def.xpMultiplier;
  localStorage.removeItem(STORAGE_KEY);
}
