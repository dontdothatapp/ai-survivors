// Programmatic pixel art — all sprites drawn to offscreen canvases
// + avatar image loading for player characters

const cache = new Map();
const avatarCache = new Map(); // characterId -> Image

function createSprite(key, w, h, drawFn) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  drawFn(ctx, w, h);
  cache.set(key, c);
  return c;
}

// Pixel helper
function px(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
}

// Preload all avatar images
export function preloadAvatars(characters) {
  for (const char of characters) {
    if (avatarCache.has(char.id)) continue;
    const img = new Image();
    img.src = char.avatar;
    avatarCache.set(char.id, img);
  }
}

// Preload ally avatar (e.g. Aleksei)
export function preloadAllyAvatar(id, src) {
  if (avatarCache.has(id)) return;
  const img = new Image();
  img.src = src;
  avatarCache.set(id, img);
}

// Get a loaded avatar image (or null if not ready)
export function getAvatarImage(characterId) {
  const img = avatarCache.get(characterId);
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
}

export function getPlayerSprite(color) {
  return createSprite('player_' + color, 32, 32, (ctx, w, h) => {
    const s = 4; // pixel size
    // Body
    ctx.fillStyle = color;
    ctx.fillRect(2*s, 2*s, 4*s, 5*s);
    // Head
    ctx.fillRect(3*s, 0, 2*s, 2*s);
    // Arms
    ctx.fillRect(0, 3*s, 2*s, s);
    ctx.fillRect(6*s, 3*s, 2*s, s);
    // Legs
    ctx.fillRect(2*s, 7*s, 2*s, s);
    ctx.fillRect(4*s, 7*s, 2*s, s);
    // Eyes
    px(ctx, 3, 0, s, '#fff');
    px(ctx, 4, 0, s, '#fff');
    // Laptop
    ctx.fillStyle = '#aaa';
    ctx.fillRect(1*s, 4*s, 2*s, 2*s);
    ctx.fillRect(5*s, 4*s, 2*s, 2*s);
  });
}

export function getEnemySprite(type) {
  return createSprite('enemy_' + type, 32, 32, (ctx, w, h) => {
    const s = 4;
    switch (type) {
      case 'jira':
        // Blue ticket shape
        ctx.fillStyle = '#2684ff';
        ctx.fillRect(s, s, 6*s, 6*s);
        ctx.fillStyle = '#fff';
        ctx.fillRect(2*s, 2*s, 4*s, s);
        ctx.fillRect(2*s, 4*s, 3*s, s);
        break;
      case 'bug':
        // Green bug
        ctx.fillStyle = '#44ff44';
        ctx.fillRect(2*s, s, 4*s, 3*s);
        // Legs
        ctx.fillRect(s, 2*s, s, s);
        ctx.fillRect(6*s, 2*s, s, s);
        ctx.fillRect(s, 4*s, s, s);
        ctx.fillRect(6*s, 4*s, s, s);
        // Body
        ctx.fillRect(2*s, 4*s, 4*s, 3*s);
        // Eyes
        px(ctx, 3, 1, s, '#f00');
        px(ctx, 4, 1, s, '#f00');
        break;
      case 'feature':
        // Purple star-ish
        ctx.fillStyle = '#cc66ff';
        ctx.fillRect(3*s, 0, 2*s, s);
        ctx.fillRect(2*s, s, 4*s, s);
        ctx.fillRect(s, 2*s, 6*s, 3*s);
        ctx.fillRect(2*s, 5*s, 4*s, s);
        ctx.fillRect(3*s, 6*s, 2*s, s);
        ctx.fillStyle = '#fff';
        ctx.fillRect(3*s, 3*s, 2*s, s); // plus
        ctx.fillRect(3.5*s, 2*s, s, 3*s);
        break;
      case 'merge':
        // Red conflict symbol
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(s, s, 6*s, 6*s);
        ctx.fillStyle = '#fff';
        // <<< >>>
        ctx.fillRect(2*s, 2*s, s, s);
        ctx.fillRect(3*s, 3*s, s, s);
        ctx.fillRect(2*s, 4*s, s, s);
        ctx.fillRect(5*s, 2*s, s, s);
        ctx.fillRect(4*s, 3*s, s, s);
        ctx.fillRect(5*s, 4*s, s, s);
        break;
      case 'flaky':
        // Blinking yellow
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(2*s, s, 4*s, 5*s);
        ctx.fillStyle = '#0a0a1a';
        px(ctx, 3, 2, s, '#0a0a1a');
        px(ctx, 4, 2, s, '#0a0a1a');
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(s, 3*s, s, s);
        ctx.fillRect(6*s, 3*s, s, s);
        // Question mark
        ctx.fillStyle = '#fff';
        ctx.fillRect(3*s, 4*s, 2*s, s);
        break;
      case 'pm':
        // Product Manager — suit
        ctx.fillStyle = '#4488ff';
        ctx.fillRect(2*s, 2*s, 4*s, 5*s);
        ctx.fillRect(3*s, 0, 2*s, 2*s); // head
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(3*s, 0, 2*s, s); // hair
        ctx.fillStyle = '#fff';
        px(ctx, 3, 1, s, '#fff');
        px(ctx, 4, 1, s, '#fff');
        // Tie
        ctx.fillStyle = '#ff0000';
        px(ctx, 3.5, 3, s/2, '#ff0000');
        ctx.fillRect(3*s+s/4, 3*s, s/2, 3*s);
        break;
      case 'em':
        // Engineering Manager — darker suit + calendar
        ctx.fillStyle = '#335577';
        ctx.fillRect(2*s, 2*s, 4*s, 5*s);
        ctx.fillRect(3*s, 0, 2*s, 2*s);
        ctx.fillStyle = '#fff';
        px(ctx, 3, 1, s, '#fff');
        px(ctx, 4, 1, s, '#fff');
        ctx.fillStyle = '#ff8844';
        ctx.fillRect(5*s, 3*s, 2*s, 2*s);
        break;
      case 'vp':
        // VP — fancy
        ctx.fillStyle = '#8844aa';
        ctx.fillRect(2*s, 2*s, 4*s, 5*s);
        ctx.fillRect(3*s, 0, 2*s, 2*s);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(2.5*s, 0, 3*s, s); // crown
        px(ctx, 3, 0, s/2, '#ffd700');
        px(ctx, 4, 0, s/2, '#ffd700');
        ctx.fillStyle = '#fff';
        px(ctx, 3, 1, s, '#fff');
        px(ctx, 4, 1, s, '#fff');
        break;
      case 'ceo':
        // CEO — black suit, grand 3-point crown, gold tie
        ctx.fillStyle = '#111122'; // dark suit
        ctx.fillRect(2*s, 2*s, 4*s, 5*s);
        ctx.fillRect(3*s, s, 2*s, 2*s); // head
        // 3-pointed crown
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(2*s, s, 4*s, s/2); // crown base
        ctx.fillRect(2*s, 0, s, s);     // left spike
        ctx.fillRect(3.5*s, 0, s, s);   // middle spike
        ctx.fillRect(5*s, 0, s, s);     // right spike
        // Eyes
        ctx.fillStyle = '#fff';
        px(ctx, 3, 2, s, '#fff');
        px(ctx, 4, 2, s, '#fff');
        // Gold tie
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(3*s + s/4, 4*s, s/2, 3*s);
        break;

      case 'ai_mini':
        // Mini AI — same look as boss, smaller
        ctx.fillStyle = '#ff2266';
        ctx.fillRect(s, s, 6*s, 6*s);
        ctx.fillStyle = '#ff66aa';
        ctx.fillRect(2*s, 2*s, 4*s, 4*s);
        ctx.fillStyle = '#fff';
        px(ctx, 3, 2, s, '#fff');
        px(ctx, 4, 2, s, '#fff');
        ctx.fillStyle = '#ff0000';
        px(ctx, 3, 3, s, '#ff0000');
        px(ctx, 4, 3, s, '#ff0000');
        break;
      case 'boss':
        // THE AI — big, red/purple
        ctx.fillStyle = '#ff2266';
        ctx.fillRect(s, s, 6*s, 6*s);
        ctx.fillStyle = '#ff66aa';
        ctx.fillRect(2*s, 2*s, 4*s, 4*s);
        ctx.fillStyle = '#fff';
        px(ctx, 3, 2, s, '#fff');
        px(ctx, 4, 2, s, '#fff');
        ctx.fillStyle = '#ff0000';
        px(ctx, 3, 3, s, '#ff0000'); // menacing eyes
        px(ctx, 4, 3, s, '#ff0000');
        break;
      default:
        ctx.fillStyle = '#888';
        ctx.fillRect(s, s, 6*s, 6*s);
    }
  });
}

export function getProjectileSprite(type) {
  return createSprite('proj_' + type, 12, 12, (ctx) => {
    switch (type) {
      case 'code_review':
        ctx.fillStyle = '#00ffaa';
        ctx.fillRect(2, 2, 8, 8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(4, 4, 4, 4);
        break;
      case 'stackoverflow':
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(1, 1, 10, 10);
        ctx.fillStyle = '#fff';
        ctx.fillRect(4, 3, 4, 2);
        ctx.fillRect(5, 5, 2, 4);
        break;
      case 'unit_test':
        ctx.fillStyle = '#44ff44';
        ctx.fillRect(3, 3, 6, 6);
        break;
      case 'hotfix':
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(6, 6, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.fillStyle = '#fff';
        ctx.fillRect(2, 2, 8, 8);
    }
  });
}

export function getXPGemSprite() {
  return createSprite('xp_gem', 12, 12, (ctx) => {
    ctx.fillStyle = '#44aaff';
    ctx.fillRect(4, 1, 4, 2);
    ctx.fillRect(2, 3, 8, 4);
    ctx.fillRect(4, 7, 4, 2);
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(5, 4, 2, 2);
  });
}
