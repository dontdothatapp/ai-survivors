// Controller — connection logic + WebSocket
import { Joystick } from './joystick.js';

const CHARACTERS = [
  { id: 'eldar', name: 'Eldar', title: 'Junior Dev', avatar: '/avatars/eldar.png', color: '#ff4466' },
  { id: 'emil', name: 'Emil', title: 'The Intern', avatar: '/avatars/emil.png', color: '#44bbff' },
  { id: 'illia', name: 'Illia', title: 'Staff Engineer', avatar: '/avatars/illia.png', color: '#44ff88' },
  { id: 'leonid', name: 'Leonid', title: '10x Engineer', avatar: '/avatars/leonid.png', color: '#ffcc44' },
  { id: 'lev', name: 'Lev', title: 'DevOps Guru', avatar: '/avatars/lev.png', color: '#ff88ff' },
  { id: 'levan', name: 'Levan', title: 'Script Kiddie', avatar: '/avatars/levan.png', color: '#88ffff' },
  { id: 'nikita', name: 'Nikita', title: 'Legacy Code Owner', avatar: '/avatars/nikita.png', color: '#ffaa44' },
  { id: 'ruslan', name: 'Ruslan', title: 'The Architect', avatar: '/avatars/ruslan.png', color: '#aa88ff' },
  { id: 'stepan', name: 'Stepan', title: 'Full Stack Overlord', avatar: '/avatars/stepan.png', color: '#ff8844' },
];

const connectingEl = document.getElementById('connecting');
const characterSelectEl = document.getElementById('characterSelect');
const characterGridEl = document.getElementById('characterGrid');
const controllerUI = document.getElementById('controllerUI');
const upgradeUI = document.getElementById('upgradeUI');
const deadUI = document.getElementById('deadUI');
const playerNameEl = document.getElementById('playerName');
const playerAvatarEl = document.getElementById('playerAvatar');
const hpFillEl = document.getElementById('hpFill');
const xpFillEl = document.getElementById('xpFill');
const levelTextEl = document.getElementById('levelText');
const upgradeOptionsEl = document.getElementById('upgradeOptions');
const deadMessageEl = document.getElementById('deadMessage');

let ws = null;
let playerId = null;
let joystick = null;
let sendInterval = null;
let hasVoted = false;
let isAlive = true;
let selectedCharacter = null;
let takenCharacters = [];

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
    joystick = null;
    selectedCharacter = null;
    connectingEl.style.display = 'flex';
    characterSelectEl.style.display = 'none';
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
      takenCharacters = msg.taken || [];
      showCharacterSelect();
      requestWakeLock();
      break;

    case 'character_confirmed':
      selectedCharacter = CHARACTERS.find(c => c.id === msg.characterId);
      showController();
      break;

    case 'character_rejected':
      // Character was taken between render and tap — update UI
      if (!takenCharacters.includes(msg.characterId)) {
        takenCharacters.push(msg.characterId);
      }
      renderCharacterGrid();
      break;

    case 'characters_update':
      takenCharacters = msg.taken || [];
      // If still on character select screen, re-render
      if (characterSelectEl.style.display !== 'none') {
        renderCharacterGrid();
      }
      break;

    case 'state':
      if (playerId === null) return;
      const me = msg.players.find(p => p.id === playerId);
      if (!me) return;
      isAlive = me.alive;
      updatePlayerInfo(me, msg.teamXP);
      break;

    case 'upgrade_prompt':
      if (isAlive) {
        hasVoted = false;
        showUpgradeOptions(msg.options);
      }
      break;

    case 'upgrade_resolved':
      showController();
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

function showCharacterSelect() {
  connectingEl.style.display = 'none';
  characterSelectEl.style.display = 'flex';
  controllerUI.style.display = 'none';
  upgradeUI.style.display = 'none';
  deadUI.style.display = 'none';
  renderCharacterGrid();
}

function renderCharacterGrid() {
  characterGridEl.innerHTML = '';
  for (const char of CHARACTERS) {
    const taken = takenCharacters.includes(char.id);
    const card = document.createElement('button');
    card.className = 'char-card' + (taken ? ' taken' : '');
    card.disabled = taken;
    card.innerHTML = `
      <img src="${char.avatar}" alt="${char.name}" />
      <span class="char-name" style="color:${char.color}">${char.name}</span>
      <span class="char-title">${char.title}</span>
    `;
    if (!taken) {
      card.addEventListener('click', () => {
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'character_select', characterId: char.id }));
        }
      });
    }
    characterGridEl.appendChild(card);
  }
}

function showController() {
  connectingEl.style.display = 'none';
  characterSelectEl.style.display = 'none';
  controllerUI.style.display = 'flex';
  upgradeUI.style.display = 'none';
  deadUI.style.display = 'none';

  if (selectedCharacter) {
    playerNameEl.textContent = selectedCharacter.name;
    playerNameEl.style.color = selectedCharacter.color;
    playerAvatarEl.src = selectedCharacter.avatar;
    playerAvatarEl.style.display = 'block';
  }

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

function updatePlayerInfo(player, teamXP) {
  if (selectedCharacter) {
    playerNameEl.textContent = selectedCharacter.name;
    playerNameEl.style.color = selectedCharacter.color;
  } else {
    playerNameEl.textContent = player.name;
    playerNameEl.style.color = player.color;
  }
  hpFillEl.style.width = `${(player.hp / player.maxHp) * 100}%`;
  if (teamXP) {
    xpFillEl.style.width = `${(teamXP.xp / teamXP.xpToNext) * 100}%`;
    levelTextEl.textContent = `Lv ${teamXP.level}`;
  }

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
      if (hasVoted) return;
      hasVoted = true;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'upgrade_pick',
          upgradeId: opt.id,
        }));
      }
      // Show waiting state
      upgradeOptionsEl.innerHTML = '<p style="color: #aaa; font-family: Courier New; text-align: center; padding: 20px;">Vote submitted! Waiting for others...</p>';
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
