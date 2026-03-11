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
export function broadcastState(players) {
  send({
    type: 'state',
    players: players.map(p => ({
      id: p.id,
      hp: p.hp,
      maxHp: p.maxHp,
      xp: p.xp,
      xpToNext: p.xpToNext,
      level: p.level,
      alive: p.alive,
      color: p.color,
      name: p.name,
    })),
  });
}

// Send upgrade prompt to specific player
export function sendUpgradePrompt(playerId, options) {
  send({
    type: 'upgrade_prompt',
    targetPlayer: playerId,
    options,
  });
}

export function sendGameOver(victory, stats) {
  send({
    type: 'game_over',
    victory,
    stats,
  });
}
