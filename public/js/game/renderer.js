// All canvas drawing
import { getPlayerSprite, getEnemySprite, getProjectileSprite, getXPGemSprite, getAvatarImage } from './sprites.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
    this.shake = { x: 0, y: 0, intensity: 0, timer: 0 };
    this.floatingTexts = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  addScreenShake(intensity = 5, duration = 0.15) {
    this.shake.intensity = intensity;
    this.shake.timer = duration;
  }

  addFloatingText(x, y, text, color = '#fff', duration = 0.8) {
    this.floatingTexts.push({ x, y, text, color, timer: duration, maxTimer: duration });
  }

  updateCamera(players, dt) {
    // Track centroid of alive players
    let cx = 0, cy = 0, count = 0;
    for (const p of players) {
      if (p.alive) { cx += p.x; cy += p.y; count++; }
    }
    if (count > 0) {
      cx /= count;
      cy /= count;
    }
    // Smooth camera
    const lerp = 1 - Math.pow(0.01, dt);
    this.camera.x += (cx - this.width / 2 - this.camera.x) * lerp;
    this.camera.y += (cy - this.height / 2 - this.camera.y) * lerp;

    // Screen shake
    if (this.shake.timer > 0) {
      this.shake.timer -= dt;
      this.shake.x = (Math.random() - 0.5) * 2 * this.shake.intensity;
      this.shake.y = (Math.random() - 0.5) * 2 * this.shake.intensity;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
    }

    // Update floating texts
    this.floatingTexts = this.floatingTexts.filter(t => {
      t.timer -= dt;
      return t.timer > 0;
    });
  }

  render(state) {
    const { ctx } = this;
    const { players, enemies, projectiles, xpGems, wave, gameTime } = state;

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(-this.camera.x + this.shake.x, -this.camera.y + this.shake.y);

    // Grid background
    this._drawGrid();

    // XP gems
    for (const gem of xpGems) {
      if (!gem.alive) continue;
      this._drawGem(gem);
    }

    // Projectiles
    for (const p of projectiles) {
      if (!p.alive) continue;
      this._drawProjectile(p);
    }

    // Enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      this._drawEnemy(e);
    }

    // Players
    for (const p of players) {
      if (!p.alive) continue;
      this._drawPlayer(p);
    }

    // Floating texts
    for (const t of this.floatingTexts) {
      const alpha = t.timer / t.maxTimer;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 14px "Courier New"';
      ctx.textAlign = 'center';
      const yOffset = (1 - alpha) * 30;
      ctx.fillText(t.text, t.x, t.y - yOffset);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // HUD overlay
    this._drawHUD(state);

    // Global event announcement
    if (state.globalEventAnnouncement) {
      this._drawGlobalEventAnnouncement(state.globalEventAnnouncement);
    }

    // Sprint announcement overlay
    if (state.sprintPause) {
      this._drawSprintAnnouncement(state);
    }

    // Voting overlay
    if (state.paused && state.votingState) {
      this._drawVotingOverlay(state.votingState);
    }
  }

  _drawSprintAnnouncement(state) {
    const { ctx, width, height } = this;
    const { sprintMessage, sprintNewEnemy, sprintPauseTimer } = state;
    const cx = width / 2;
    const cy = height / 2;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 10, 0.82)';
    ctx.fillRect(0, 0, width, height);

    // Sprint title
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 28px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(sprintMessage, cx, cy - 90);

    if (sprintNewEnemy) {
      // Warning label
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 16px "Courier New"';
      ctx.fillText('[ NEW THREAT DETECTED ]', cx, cy - 48);

      // Enemy sprite scaled up (pixel art — disable smoothing)
      const sprite = getEnemySprite(sprintNewEnemy.type);
      const spriteSize = sprintNewEnemy.type === 'boss' ? 128 : 96;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, cx - spriteSize / 2, cy - 36, spriteSize, spriteSize);
      ctx.imageSmoothingEnabled = true;

      // Enemy name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Courier New"';
      ctx.fillText(sprintNewEnemy.name, cx, cy + spriteSize - 24);
    }

    // Countdown
    const secs = Math.ceil(sprintPauseTimer);
    ctx.fillStyle = '#555';
    ctx.font = '13px "Courier New"';
    ctx.fillText(`Starting in ${secs}...`, cx, cy + 130);
  }

  _drawGrid() {
    const { ctx, camera, width, height } = this;
    const gridSize = 80;
    ctx.strokeStyle = '#151525';
    ctx.lineWidth = 1;
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;
    for (let x = startX; x < camera.x + width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, camera.y);
      ctx.lineTo(x, camera.y + height);
      ctx.stroke();
    }
    for (let y = startY; y < camera.y + height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(camera.x, y);
      ctx.lineTo(camera.x + width, y);
      ctx.stroke();
    }
  }

  _drawPlayer(player) {
    const { ctx } = this;
    const { x, y, color, name, hp, maxHp, level, invincibleTimer, radius, characterId } = player;

    // Invincibility flash
    if (invincibleTimer > 0 && Math.floor(invincibleTimer * 20) % 2) return;

    // Try avatar image first, fall back to pixel sprite
    const avatarImg = characterId ? getAvatarImage(characterId) : null;
    if (avatarImg) {
      ctx.drawImage(avatarImg, x - 16, y - 16, 32, 32);
    } else {
      const sprite = getPlayerSprite(color);
      ctx.drawImage(sprite, x - 16, y - 16, 32, 32);
    }

    // Rubber duck orbit
    if (player.weapons.some(w => w.type === 'rubber_duck')) {
      const duckX = x + Math.cos(player.rubberDuckAngle) * 50;
      const duckY = y + Math.sin(player.rubberDuckAngle) * 50;
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath();
      ctx.arc(duckX, duckY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coffee aura
    if (player.coffeeActive) {
      ctx.strokeStyle = '#8B451366';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 120, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HP bar
    const barW = 30;
    const barH = 4;
    const barY = y - 22;
    ctx.fillStyle = '#333';
    ctx.fillRect(x - barW / 2, barY, barW, barH);
    ctx.fillStyle = hp / maxHp > 0.3 ? '#ff4444' : '#ff0000';
    ctx.fillRect(x - barW / 2, barY, barW * (hp / maxHp), barH);

    // Name below character
    ctx.fillStyle = color;
    ctx.font = '11px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(name, x, y + 26);
  }

  _drawEnemy(enemy) {
    const { ctx } = this;
    const { x, y, type, flash, hp, maxHp, radius, frozenTimer } = enemy;

    // Frozen indicator
    if (frozenTimer > 0) {
      ctx.fillStyle = '#44aaff44';
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit flash
    if (flash > 0) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.globalAlpha = 1;
      return;
    }

    // Sprite
    const size = type === 'boss' ? 64 : type === 'ai_mini' ? 48 : 32;
    const sprite = getEnemySprite(type);
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);

    // HP bar for elites and boss
    if (type === 'pm' || type === 'em' || type === 'vp' || type === 'ceo' || type === 'boss' || type === 'ai_mini') {
      const barW = type === 'boss' ? 60 : 36;
      const barH = 4;
      const barY = y - size / 2 - 6;
      ctx.fillStyle = '#333';
      ctx.fillRect(x - barW / 2, barY, barW, barH);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(x - barW / 2, barY, barW * (hp / maxHp), barH);
    }
  }

  _drawProjectile(proj) {
    const { ctx } = this;

    if (proj.isAOE) {
      // AOE pulse ring
      const alpha = proj.lifetime / 0.3;
      ctx.strokeStyle = `rgba(255, 100, 100, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.aoe * (1 - alpha * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    const sprite = getProjectileSprite(proj.type);
    ctx.drawImage(sprite, proj.x - 6, proj.y - 6, 12, 12);
  }

  _drawGem(gem) {
    const sprite = getXPGemSprite();
    this.ctx.drawImage(sprite, gem.x - 6, gem.y - 6, 12, 12);
  }

  _drawHUD(state) {
    const { ctx, width, height } = this;
    const { wave, gameTime, players, enemies } = state;

    // Wave & time
    ctx.fillStyle = '#888';
    ctx.font = '14px "Courier New"';
    ctx.textAlign = 'left';
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    ctx.fillText(`Sprint ${wave}  |  ${minutes}:${seconds.toString().padStart(2, '0')}`, 10, 20);

    // Player count
    const alive = players.filter(p => p.alive).length;
    ctx.textAlign = 'right';
    ctx.fillText(`Engineers: ${alive}/${players.length}`, width - 10, 20);

    // Mini player bars at top
    let barX = 10;
    for (const p of players) {
      const barW = 60;
      const barH = 6;
      ctx.fillStyle = '#222';
      ctx.fillRect(barX, 30, barW, barH);
      ctx.fillStyle = p.alive ? p.color : '#333';
      ctx.fillRect(barX, 30, barW * (p.hp / p.maxHp), barH);
      ctx.fillStyle = p.alive ? '#aaa' : '#555';
      ctx.font = '9px "Courier New"';
      ctx.textAlign = 'left';
      ctx.fillText(p.name.substring(0, 8), barX, 28);
      barX += barW + 8;
    }

    // Team XP bar (top center)
    if (state.teamXP) {
      const txp = state.teamXP;
      const barW = 200;
      const barH = 8;
      const barX = (width - barW) / 2;
      const barY = 30;
      ctx.fillStyle = '#222';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#44ff88';
      ctx.fillRect(barX, barY, barW * (txp.xp / txp.xpToNext), barH);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = '#aaa';
      ctx.font = '10px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(`Team Lv ${txp.level}  (${txp.xp}/${txp.xpToNext} XP)`, width / 2, barY + barH + 12);
    }

    // Debug: enemy count overlay (bottom-left)
    const aliveEnemies = enemies.filter(e => e.alive);
    const byType = {};
    for (const e of aliveEnemies) byType[e.type] = (byType[e.type] || 0) + 1;
    const lines = [`enemies: ${aliveEnemies.length}`,
      ...Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => `  ${t}: ${n}`)
    ];
    ctx.font = '11px "Courier New"';
    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(8, height - 16 - (lines.length - i - 1) * 14, 130, 13);
      ctx.fillStyle = '#0f0';
      ctx.fillText(line, 10, height - 5 - (lines.length - i - 1) * 14);
    });
  }

  _drawGlobalEventAnnouncement(announcement) {
    const { ctx, width, height } = this;
    const cx = width / 2;
    const cy = height / 2;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 10, 0.82)';
    ctx.fillRect(0, 0, width, height);

    // Scanline flicker effect
    const flicker = Math.sin(announcement.timer * 12) * 0.04;
    ctx.fillStyle = `rgba(255, 50, 50, ${0.03 + flicker})`;
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1);
    }

    // Warning label
    ctx.fillStyle = '#ff2222';
    ctx.font = 'bold 14px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('[ GLOBAL EVENT ]', cx, cy - 60);

    // Event name — large, pulsing
    const pulse = 1 + Math.sin(announcement.timer * 8) * 0.05;
    ctx.save();
    ctx.translate(cx, cy - 10);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 42px "Courier New"';
    ctx.fillText(announcement.name, 0, 0);
    ctx.restore();

    // Description
    ctx.fillStyle = '#cccccc';
    ctx.font = '18px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(announcement.desc, cx, cy + 36);

    // Countdown
    const secs = Math.ceil(announcement.timer);
    ctx.fillStyle = '#555';
    ctx.font = '13px "Courier New"';
    ctx.fillText(`Activating in ${secs}...`, cx, cy + 90);
  }

  _drawVotingOverlay(votingState) {
    const { ctx, width, height } = this;
    const { options, votes, totalVoters } = votingState;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 32px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL UP!', width / 2, height / 2 - 130);

    // Vote progress
    const voteCount = votes.length;
    ctx.fillStyle = '#aaa';
    ctx.font = '14px "Courier New"';
    ctx.fillText(`Votes: ${voteCount} / ${totalVoters}`, width / 2, height / 2 - 100);

    // Upgrade cards
    const cardW = 180;
    const cardH = 120;
    const gap = 20;
    const totalW = options.length * cardW + (options.length - 1) * gap;
    const startX = (width - totalW) / 2;
    const cardY = height / 2 - 60;

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const cx = startX + i * (cardW + gap);

      // Card background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(cx, cardY, cardW, cardH);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cardY, cardW, cardH);

      // Card name
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 12px "Courier New"';
      ctx.textAlign = 'center';
      const nameX = cx + cardW / 2;
      // Word wrap the name
      const nameWords = opt.name.split(' ');
      let nameLine = '';
      let nameLineY = cardY + 24;
      for (const word of nameWords) {
        const test = nameLine ? nameLine + ' ' + word : word;
        if (ctx.measureText(test).width > cardW - 16) {
          ctx.fillText(nameLine, nameX, nameLineY);
          nameLine = word;
          nameLineY += 14;
        } else {
          nameLine = test;
        }
      }
      if (nameLine) ctx.fillText(nameLine, nameX, nameLineY);

      // Card description
      ctx.fillStyle = '#ccc';
      ctx.font = '11px "Courier New"';
      ctx.fillText(opt.desc, nameX, cardY + 70);

      // Vote dots below card
      const votesForThis = votes.filter(v => v.upgradeId === opt.id);
      const dotY = cardY + cardH + 16;
      const dotStartX = nameX - (votesForThis.length - 1) * 10 / 2;
      for (let j = 0; j < votesForThis.length; j++) {
        ctx.fillStyle = votesForThis[j].color;
        ctx.beginPath();
        ctx.arc(dotStartX + j * 10, dotY, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
