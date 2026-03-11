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

// Call on first user interaction to unlock audio
export function unlockAudio() {
  getCtx();
}
