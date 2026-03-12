// Web Audio API retro sound effects
let ctx = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

function playTone(freq, duration, type = 'square', volume = 0.15) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  } catch {}
}

export function playHit() {
  playTone(200, 0.08, 'square', 0.1);
}

export function playKill() {
  playTone(400, 0.05, 'square', 0.1);
  setTimeout(() => playTone(600, 0.08, 'square', 0.1), 50);
}

export function playLevelUp() {
  playTone(400, 0.1, 'square', 0.12);
  setTimeout(() => playTone(500, 0.1, 'square', 0.12), 80);
  setTimeout(() => playTone(700, 0.15, 'square', 0.12), 160);
}

export function playWaveStart() {
  playTone(150, 0.15, 'sawtooth', 0.1);
  setTimeout(() => playTone(200, 0.2, 'sawtooth', 0.1), 100);
}

export function playBossAppear() {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playTone(100 + i * 30, 0.15, 'sawtooth', 0.15), i * 100);
  }
}

export function playPickup() {
  playTone(800, 0.05, 'sine', 0.08);
}

export function playPlayerHit() {
  playTone(100, 0.12, 'sawtooth', 0.12);
}

export function playVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.2, 'square', 0.12), i * 150);
  });
}

export function playDeath() {
  for (let i = 0; i < 4; i++) {
    setTimeout(() => playTone(300 - i * 50, 0.15, 'sawtooth', 0.12), i * 100);
  }
}

export function playGlobalEvent() {
  // Dramatic 8-bit alarm: descending ominous chord then rising sting
  try {
    const c = getCtx();
    const t = c.currentTime;

    // Low rumble sweep
    const rumble = c.createOscillator();
    const rumbleGain = c.createGain();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(80, t);
    rumble.frequency.linearRampToValueAtTime(50, t + 0.3);
    rumbleGain.gain.setValueAtTime(0.12, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    rumble.connect(rumbleGain);
    rumbleGain.connect(c.destination);
    rumble.start(t);
    rumble.stop(t + 0.4);

    // Descending alarm hits
    const alarmNotes = [600, 500, 400, 300];
    alarmNotes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.12, 'square', 0.15), i * 80);
    });

    // Rising sting after alarm
    const stingNotes = [200, 350, 500, 700, 900];
    stingNotes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.08, 'square', 0.1), 350 + i * 50);
    });

    // Final impact
    setTimeout(() => {
      playTone(120, 0.25, 'sawtooth', 0.18);
      playTone(180, 0.2, 'square', 0.12);
    }, 620);
  } catch {}
}

// Aleksei ally music
let alekseiAudio = null;

export function playAlekseiMusic() {
  stopAlekseiMusic();
  alekseiAudio = new Audio('/sounds/aleksei.mp3');
  alekseiAudio.volume = 0.4;
  alekseiAudio.play().catch(() => {});
}

export function stopAlekseiMusic() {
  if (alekseiAudio) {
    alekseiAudio.pause();
    alekseiAudio.currentTime = 0;
    alekseiAudio = null;
  }
}

// Final boss music
let bossAudio = null;

export function playBossMusic() {
  stopBossMusic();
  bossAudio = new Audio('/sounds/ai_final_boss.mp3');
  bossAudio.volume = 0.4;
  bossAudio.loop = true;
  bossAudio.play().catch(() => {});
}

export function stopBossMusic() {
  if (bossAudio) {
    bossAudio.pause();
    bossAudio.currentTime = 0;
    bossAudio = null;
  }
}

// Call on first user interaction to unlock audio
export function unlockAudio() {
  getCtx();
}
