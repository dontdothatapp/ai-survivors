import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'os';

const PORT = 3000;
const PUBLIC = join(import.meta.dirname, 'public');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// --- HTTP static file server ---
const server = createServer(async (req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/game.html';
  const filePath = join(PUBLIC, url);
  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

// --- WebSocket relay ---
const wss = new WebSocketServer({ server });

let gameScreen = null;
const controllers = new Map(); // playerId -> ws
let nextPlayerId = 0;
const takenCharacters = new Map(); // characterId -> playerId

function getAvailableCharacters() {
  const taken = [...takenCharacters.keys()];
  return taken;
}

function broadcastCharactersUpdate() {
  const taken = getAvailableCharacters();
  const msg = JSON.stringify({ type: 'characters_update', taken });
  for (const [, cws] of controllers) {
    if (cws.readyState === 1) cws.send(msg);
  }
}

wss.on('connection', (ws, req) => {
  const url = req.url;

  if (url === '/game') {
    gameScreen = ws;
    ws.on('close', () => { gameScreen = null; });
    ws.on('message', (raw) => {
      // Forward game state to all controllers
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'state' || msg.type === 'upgrade_prompt' || msg.type === 'upgrade_resolved' || msg.type === 'game_start' || msg.type === 'game_over') {
          if (msg.targetPlayer !== undefined) {
            // Send to specific player
            for (const [pid, cws] of controllers) {
              if (pid === msg.targetPlayer && cws.readyState === 1) {
                cws.send(raw.toString());
              }
            }
          } else {
            // Broadcast to all controllers
            for (const [, cws] of controllers) {
              if (cws.readyState === 1) cws.send(raw.toString());
            }
          }
        }
      } catch {}
    });
    // Notify game screen of all currently connected players who have selected characters
    for (const [characterId, playerId] of takenCharacters) {
      ws.send(JSON.stringify({ type: 'player_joined', playerId, characterId }));
    }
    return;
  }

  if (url === '/controller') {
    const playerId = nextPlayerId++;
    controllers.set(playerId, ws);
    // Send assigned + taken characters so controller can show selection UI
    ws.send(JSON.stringify({
      type: 'assigned',
      playerId,
      taken: getAvailableCharacters(),
    }));
    // Don't send player_joined to game screen yet — wait for character selection

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);

        if (msg.type === 'character_select') {
          const characterId = msg.characterId;
          // Check if character is available
          if (takenCharacters.has(characterId)) {
            ws.send(JSON.stringify({ type: 'character_rejected', characterId }));
            return;
          }
          // Mark as taken
          takenCharacters.set(characterId, playerId);
          ws.send(JSON.stringify({ type: 'character_confirmed', characterId }));
          // Notify game screen
          if (gameScreen && gameScreen.readyState === 1) {
            gameScreen.send(JSON.stringify({ type: 'player_joined', playerId, characterId }));
          }
          // Broadcast updated taken list to all controllers
          broadcastCharactersUpdate();
          return;
        }

        // Forward other input to game screen
        if (gameScreen && gameScreen.readyState === 1) {
          msg.playerId = playerId;
          gameScreen.send(JSON.stringify(msg));
        }
      } catch {}
    });
    ws.on('close', () => {
      controllers.delete(playerId);
      // Release character
      for (const [charId, pid] of takenCharacters) {
        if (pid === playerId) {
          takenCharacters.delete(charId);
          break;
        }
      }
      // Notify game screen
      if (gameScreen && gameScreen.readyState === 1) {
        gameScreen.send(JSON.stringify({ type: 'player_left', playerId }));
      }
      // Broadcast updated taken list
      broadcastCharactersUpdate();
    });
    return;
  }

  ws.close();
});

// --- Start ---
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

server.listen(PORT, () => {
  const ip = getLocalIP();
  console.log(`\n  🎮 AI SURVIVORS`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Game screen:  http://${ip}:${PORT}/`);
  console.log(`  Controller:   http://${ip}:${PORT}/controller.html`);
  console.log(`  ─────────────────────────────────\n`);
});
