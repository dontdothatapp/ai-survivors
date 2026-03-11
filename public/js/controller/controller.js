// Controller — connection logic + WebSocket
import { Joystick } from './joystick.js';

const connectingEl = document.getElementById('connecting');
const controllerUI = document.getElementById('controllerUI');
const upgradeUI = document.getElementById('upgradeUI');
const deadUI = document.getElementById('deadUI');
const playerNameEl = document.getElementById('playerName');
const hpFillEl = document.getElementById('hpFill');
const xpFillEl = document.getElementById('xpFill');
const levelTextEl = document.getElementById('levelText');
const upgradeOptionsEl = document.getElementById('upgradeOptions');
const deadMessageEl = document.getElementById('deadMessage');

let ws = null;
let playerId = null;
let joystick = null;
let sendInterval = null;

// Screen wake lock
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      await navigator.wakeLock.request('screen');
    }
  } catch {}
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/controller`);

  ws.onopen = () => {
    console.log('[controller] connected');
  };

  ws.onclose = () => {
    console.log('[controller] disconnected, reconnecting...');
    clearInterval(sendInterval);
    connectingEl.style.display = 'flex';
    controllerUI.style.display = 'none';
    upgradeUI.style.display = 'none';
    deadUI.style.display = 'none';
    setTimeout(connect, 1000);
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleMessage(msg);
    } catch {}
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'assigned':
      playerId = msg.playerId;
      showController();
      requestWakeLock();
      break;

    case 'state':
      if (playerId === null) return;
      const me = msg.players.find(p => p.id === playerId);
      if (!me) return;
      updatePlayerInfo(me);
      break;

    case 'upgrade_prompt':
      showUpgradeOptions(msg.options);
      break;

    case 'game_start':
      showController();
      break;

    case 'game_over':
      if (msg.victory) {
        deadMessageEl.textContent = 'Your job is safe... until the next reorg.';
      } else {
        deadMessageEl.textContent = 'The codebase has been deprecated.';
      }
      showDead();
      break;
  }
}

function showController() {
  connectingEl.style.display = 'none';
  controllerUI.style.display = 'flex';
  upgradeUI.style.display = 'none';
  deadUI.style.display = 'none';

  if (!joystick) {
    const joyCanvas = document.getElementById('joystickCanvas');
    joystick = new Joystick(joyCanvas, (dx, dy) => {
      // Joystick change — we send at fixed rate below
    });

    // Send input at ~30 Hz
    sendInterval = setInterval(() => {
      if (ws && ws.readyState === 1 && playerId !== null) {
        ws.send(JSON.stringify({
          type: 'input',
          dx: joystick.dx,
          dy: joystick.dy,
        }));
      }
    }, 33);
  }
}

function updatePlayerInfo(player) {
  playerNameEl.textContent = player.name;
  playerNameEl.style.color = player.color;
  hpFillEl.style.width = `${(player.hp / player.maxHp) * 100}%`;
  xpFillEl.style.width = `${(player.xp / player.xpToNext) * 100}%`;
  levelTextEl.textContent = `Lv ${player.level}`;

  if (!player.alive && controllerUI.style.display !== 'none') {
    showDead();
  }
}

function showUpgradeOptions(options) {
  controllerUI.style.display = 'none';
  upgradeUI.style.display = 'flex';
  deadUI.style.display = 'none';

  upgradeOptionsEl.innerHTML = '';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.className = 'upgrade-btn';
    btn.innerHTML = `<span class="name">${opt.name}</span><span class="desc">${opt.desc}</span>`;
    btn.addEventListener('click', () => {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'upgrade_pick',
          upgradeId: opt.id,
        }));
      }
      showController();
    });
    upgradeOptionsEl.appendChild(btn);
  }
}

function showDead() {
  controllerUI.style.display = 'none';
  upgradeUI.style.display = 'none';
  deadUI.style.display = 'flex';
}

// --- Init ---
connect();
