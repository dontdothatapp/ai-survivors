// Game screen WebSocket client
let ws = null;
let onMessage = null;

export function connect(messageHandler) {
  onMessage = messageHandler;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/game`);

  ws.onopen = () => console.log('[game] WebSocket connected');
  ws.onclose = () => {
    console.log('[game] WebSocket closed, reconnecting...');
    setTimeout(() => connect(messageHandler), 1000);
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (onMessage) onMessage(msg);
    } catch {}
  };
}

export function send(msg) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

// Send state to all controllers
export function broadcastState(players, teamXP) {
  send({
    type: 'state',
    teamXP: { xp: teamXP.xp, xpToNext: teamXP.xpToNext, level: teamXP.level },
    players: players.map(p => ({
      id: p.id,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      color: p.color,
      name: p.name,
      characterId: p.characterId,
    })),
  });
}

// Send upgrade prompt to all players (no targetPlayer = broadcast)
export function sendUpgradePromptToAll(options) {
  send({
    type: 'upgrade_prompt',
    options,
  });
}

// Dismiss upgrade UI on all controllers
export function sendUpgradeResolved() {
  send({
    type: 'upgrade_resolved',
  });
}

export function sendGameOver(victory, stats) {
  send({
    type: 'game_over',
    victory,
    stats,
  });
}
