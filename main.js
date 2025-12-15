/**
 * MONAD Hero Section
 * 
 * 1. Grid Creation
 * 2. State Machine (INIT -> FORM_TEXT -> IDLE)
 * 3. Rendering
 * 4. Interaction
 */

// --- Configuration ---
const CONFIG = {
  SPACING: 18,      // Grid spacing (px) - Increased for lower density
  BASE_RADIUS: 3.0, // Base dot radius - Increased
  MAX_RADIUS: 8,    // Max radius on hover
  TEXT: "MONAD",
  FONT_SIZE: 400,   // px - Doubled size
  FONT_FAMILY: "Inter, sans-serif",
  NOISE_SCALE: 0.005,
  STAGES: {
    INIT: 0,
    FORM_TEXT: 1,
    IDLE: 2,
    GAME: 3 // New Stage
  },
  DURATIONS: {
    INIT: 1800,      // ms
    FORM_TEXT: 1200  // ms
  }
};

const THEMES = [
  { name: 'dark', bg: '#000000', dot: '#ffffff', shape: 'circle' },
  { name: 'light', bg: '#ffffff', dot: '#000000', shape: 'circle' },
  { name: 'lcd', bg: '#bad24c', dot: '#94ab26', shape: 'square' }
];
let currentThemeIndex = 0;

// ... (Noise class same) ...
class SimpleNoise {
  constructor() {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Shuffle
    for (let i = 255; i > 0; i--) {
      const r = Math.floor(Math.random() * (i + 1));
      [p[i], p[r]] = [p[r], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }
  grad(hash, x, y) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const A = this.perm[X] + Y;
    const B = this.perm[X + 1] + Y;
    return this.lerp(v,
      this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
      this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
    );
  }
}

const noiseGen = new SimpleNoise();
function noise(x) {
  // 1D usage of 2D noise for simplicity
  return (noiseGen.noise2D(x, 0) + 1) / 2;
}


// --- Global State ---
const canvas = document.getElementById('dot-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let dots = [];
let grid = []; // 2D grid for O(1) access
let cols = 0;
let rows = 0;
let currentStage = CONFIG.STAGES.INIT;
let gamePlaying = false;
let lastGameTick = 0;
const GAME_TICK_RATE = 100; // ms
let startTime = Date.now();
let mouse = { x: -9999, y: -9999 };
let visualScale = 1; // Scaling factor for responsiveness
let scrollY = 0; // Track scroll position
let isDragging = false; // For mouse interaction

// --- Dot Class ---
class Dot {
  constructor(x, y, col, row) {
    this.x = x;
    this.y = y;
    this.col = col;
    this.row = row;

    this.alive = false;
    this.nextAlive = false;

    this.originX = x; // Store original X
    this.originY = y; // Store original Y for restoration
    this.baseRadius = CONFIG.BASE_RADIUS * visualScale; // Scale radius
    this.radius = this.baseRadius;

    this.opacity = 0;
    this.targetOpacity = 0;

    this.isText = false;
    this.noiseOffset = Math.random() * 1000;

    // Use a persistent bias for noise so specific dots are always dark
    // This helps the "0.0 more probable" feel consistent rather than flickering too much
    this.noiseBias = Math.random();
  }

  update(time, elapsedTime) {
    // State Machine Logic for Opacity
    if (currentStage === CONFIG.STAGES.INIT) {
      // Scanline effect: y position determines delay
      const delay = this.y * 0.002 * 1000; // ms
      const t = elapsedTime - delay;

      if (t > 0) {
        // Fade in up to 0.3
        this.opacity = Math.min(0.3, t * 0.0005);
      } else {
        this.opacity = 0;
      }

    } else if (currentStage === CONFIG.STAGES.GAME) {
      // Game of Life Rendering
      if (this.alive) {
        this.targetOpacity = 1.0;
      } else {
        this.targetOpacity = 0.05; // Faint trace of grid
      }
      this.opacity += (this.targetOpacity - this.opacity) * 0.2;

      // Reset Physics
      this.x += (this.originX - this.x) * 0.1;
      this.y += (this.originY - this.y) * 0.1;
      this.radius += (this.baseRadius - this.radius) * 0.1;
      return; // Skip other physics in game mode

    } else if (currentStage === CONFIG.STAGES.FORM_TEXT || currentStage === CONFIG.STAGES.IDLE) {

      // Staggered transition logic for FORM_TEXT
      if (currentStage === CONFIG.STAGES.FORM_TEXT) {
        const stageTime = elapsedTime - CONFIG.DURATIONS.INIT;
        // Use noiseBias (0~1) to create a delay up to 1500ms
        const triggerTime = this.noiseBias * 1500;

        if (stageTime < triggerTime) {
          // Before trigger, keep opacity roughly where it was (or slowly fade text in/out?)
          // To make them "turn off one by one", we maintain their previous visible state
          // or let them hover around 0.3
          // But if they just freeze, it looks like a pause.
          // Let's make them slightly alive but not changing state yet.
          return;
        }
      }

      // Target Opacity Calculation
      if (this.isText) {
        this.targetOpacity = 1.0;
      } else {
        // Noise based ambient with bias to darkness
        this.noiseOffset += 0.005;
        let n = noise(this.noiseOffset);

        // Bias towards 0:
        // Threshold lowered to 0.55 to make more dots visible (user request)
        if (n < 0.55) {
          n = 0;
        } else {
          // Remap 0.55~1.0 to 0.0~0.4
          n = ((n - 0.55) / 0.45) * 0.4;
        }

        this.targetOpacity = n;
      }

      // Smooth transition
      this.opacity += (this.targetOpacity - this.opacity) * 0.08;
    }

    // Mouse Interaction (Radius)
    const dx = this.x - mouse.x;
    const dy = this.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const interactionRadius = 150 * visualScale; // Scale interaction radius too

    if (dist < interactionRadius) {
      const force = 1 - dist / interactionRadius;
      let multiplier = 0.8;
      if (this.isText) multiplier = 0.3; // Less explosion for text

      // Reduced hover effect from * 8 to * 4 as requested
      const targetR = this.baseRadius * (1 + force * 4 * multiplier);
      // Simple ease
      this.radius += (targetR - this.radius) * 0.2;
    } else {
      this.radius += (this.baseRadius - this.radius) * 0.2;
    }

    // --- Evaporation Effect ---
    // Calculate evaporation factor (0 to 1) based on scroll
    const viewportHeight = window.innerHeight;
    const currentScroll = window.scrollY || window.pageYOffset; // Robust scroll capture
    // Start earlier and end later
    const scrollFactor = Math.min(1, Math.max(0, currentScroll / (viewportHeight * 0.6))); // Faster trigger

    if (scrollFactor > 0) {
      // Nonlinear lift: Accelerate as they go up
      // Power of 4 for even more dramatic "sucking" start
      const ease = Math.pow(scrollFactor, 4);

      // Random variance per dot to break rigidity
      const variance = 1 + this.noiseBias * 0.8;

      const lift = ease * viewportHeight * 2.5 * variance;
      this.y = this.originY - lift;

      // Turbulence (Horizontal Wiggle)
      // Use elapsedTime for better precision
      const wiggle = Math.sin(elapsedTime * 0.003 + this.noiseBias * 20) * (ease * 100);
      this.x = this.originX + wiggle;

      // Scale down to simulate distance
      this.radius *= Math.max(0, 1 - scrollFactor);

      // Fade out
      this.opacity *= Math.max(0, 1 - scrollFactor * 0.8);
    } else {
      this.y = this.originY;
      this.x = this.originX;
    }
  }

  draw(ctx) {
    if (this.opacity <= 0.01) return;

    const theme = THEMES[currentThemeIndex];
    ctx.fillStyle = theme.name === 'lcd'
      ? `rgba(148, 171, 38, ${this.opacity})` // LCD color hardcoded-ish or we parse hex to rbga?
      // Simple hack: if theme is light, black with opacity. If dark, white with opacity.
      // For LCD, use dot color. But we need RGBA for opacity.
      // Let's assume hex for now and just set globalAlpha?
      // Better: Set globalAlpha -> fillStyle -> fill
      : (theme.name === 'light' ? `rgba(0, 0, 0, ${this.opacity})` : `rgba(255, 255, 255, ${this.opacity})`);

    // Better color handling:
    // We already use opacity property.
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = theme.dot;

    ctx.beginPath();
    if (theme.shape === 'square') {
      const size = this.radius * 2;
      ctx.fillRect(this.x - this.radius, this.y - this.radius, size, size);
    } else {
      ctx.arc(this.x, this.y, Math.abs(this.radius), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0; // Reset
  }
}

// --- Initialization ---

function init() {
  resize();
  createGrid();
  mapText();

  // Start Loop
  loop();
}


function resize() {
  const dpr = window.devicePixelRatio || 1;

  // Logical size
  width = window.innerWidth;
  height = window.innerHeight;

  // Calculate Visual Scale based on 1920px width baseline
  // Clamp to minimum 0.6 to prevent dots disappearing on very small screens
  visualScale = Math.max(width / 1920, 0.6);

  // Physical size
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  // CSS size
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  // Normalize coordinate system
  ctx.scale(dpr, dpr);
}

function createGrid() {
  dots = [];
  grid = [];
  const spacing = CONFIG.SPACING * visualScale; // Scale spacing

  cols = Math.ceil(width / spacing);
  rows = Math.ceil(height / spacing);

  for (let r = 0; r < rows; r++) {
    const rowArr = [];
    for (let c = 0; c < cols; c++) {
      const x = c * spacing + spacing / 2; // Center offset
      const y = r * spacing + spacing / 2;

      const dot = new Dot(x, y, c, r);
      dots.push(dot);
      rowArr.push(dot);
    }
    grid.push(rowArr);
  }
}

function mapText() {
  // 1. Create Offscreen Canvas
  const offCanvas = document.createElement('canvas');
  offCanvas.width = width;
  offCanvas.height = height;
  const offCtx = offCanvas.getContext('2d');

  // 2. Draw Text
  offCtx.fillStyle = "white";
  offCtx.font = `bold ${CONFIG.FONT_SIZE * visualScale}px ${CONFIG.FONT_FAMILY}`; // Scale font
  offCtx.textAlign = "center";
  offCtx.textBaseline = "middle";
  offCtx.fillText(CONFIG.TEXT, width / 2, height / 2);

  // 3. Check Dots
  // Get all pixel data at once for performance
  const imageData = offCtx.getImageData(0, 0, width, height).data;

  dots.forEach(dot => {
    // Integer coord
    const ix = Math.floor(dot.x);
    const iy = Math.floor(dot.y);

    // Safety check
    if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
      const index = (iy * width + ix) * 4;
      // Alpha channel > 0 means text
      if (imageData[index + 3] > 0) {
        dot.isText = true;
        // If we switch to game mode, text dots start alive
        dot.alive = true;
      }
    }
  });
}

// --- Interaction ---
window.addEventListener('resize', () => {
  resize();
  createGrid();
  mapText();
});


window.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;

  // Drag to paint
  if (isMouseDown && currentStage >= CONFIG.STAGES.IDLE) {
    // If simply dragging in IDLE, switch to GAME
    if (currentStage === CONFIG.STAGES.IDLE) {
      enterGameMode();
    }

    // Paint logic
    // Find closest dot (grid cell)
    const spacing = CONFIG.SPACING * visualScale;
    // Simple approximation
    dots.forEach(dot => {
      const dx = dot.x - mouse.x;
      const dy = dot.y - mouse.y;
      if (dx * dx + dy * dy < (spacing * spacing)) {
        dot.alive = true;
        dot.opacity = 1;
      }
    });
  }
});

let isMouseDown = false;
window.addEventListener('mousedown', () => isMouseDown = true);
window.addEventListener('mouseup', () => isMouseDown = false);

window.addEventListener('scroll', () => {
  scrollY = window.scrollY;
  // Exit game mode on scroll?
  if (scrollY > 50 && currentStage === CONFIG.STAGES.GAME) {
    // Maybe pause or just let it coexist? 
    // User asked for "evaporation", so game should probably pause or exit.
    // Let's keep it simple.
  }
});

// --- Game Logic ---
function enterGameMode() {
  if (currentStage === CONFIG.STAGES.GAME) return;
  currentStage = CONFIG.STAGES.GAME;
  document.getElementById('game-controls').classList.add('active');

  // Convert current text state to alive if not already
  // (Handled in mapText, but if we want to reset to text state we can)
}

function exitGameMode() {
  currentStage = CONFIG.STAGES.IDLE; // Or reform text?
  gamePlaying = false;
  document.getElementById('game-controls').classList.remove('active');
  document.getElementById('btn-play').style.display = 'block';
  document.getElementById('btn-pause').style.display = 'none';

  // Restore text state?
  // Let's just go back to IDLE which will use noise/text logic
}

function updateGame() {
  // 1. Compute Next State
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dot = grid[r][c];
      let neighbors = 0;

      // Check 8 neighbors
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          const nr = r + i;
          const nc = c + j;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            if (grid[nr][nc].alive) neighbors++;
          }
        }
      }

      if (dot.alive) {
        dot.nextAlive = (neighbors === 2 || neighbors === 3);
      } else {
        dot.nextAlive = (neighbors === 3);
      }
    }
  }

  // 2. Apply State
  dots.forEach(dot => dot.alive = dot.nextAlive);
}

// --- UI Binding ---
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnClose = document.getElementById('btn-close');

btnPlay.addEventListener('click', () => {
  gamePlaying = true;
  btnPlay.style.display = 'none';
  btnPause.style.display = 'block';
});

btnPause.addEventListener('click', () => {
  gamePlaying = false;
  btnPlay.style.display = 'block';
  btnPause.style.display = 'none';
});

btnReset.addEventListener('click', () => {
  // Kill all
  dots.forEach(d => d.alive = false);
  gamePlaying = false;
  btnPlay.style.display = 'block';
  btnPause.style.display = 'none';
});


btnClose.addEventListener('click', exitGameMode);

// --- Theme Logic ---
const btnPrev = document.getElementById('theme-prev');
const btnNext = document.getElementById('theme-next');

function setTheme(index) {
  currentThemeIndex = (index + THEMES.length) % THEMES.length;
  const theme = THEMES[currentThemeIndex];

  // Update Body BG
  document.body.style.backgroundColor = theme.bg;

  // Update nav button colors for visibility logic (simple inversion)
  const navColor = theme.name === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
  const navHover = theme.name === 'light' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';

  [btnPrev, btnNext].forEach(btn => {
    btn.style.color = navColor;
    btn.onmouseenter = () => btn.style.color = navHover;
    btn.onmouseleave = () => btn.style.color = navColor;
  });
}

btnPrev.addEventListener('click', () => setTheme(currentThemeIndex - 1));
btnNext.addEventListener('click', () => setTheme(currentThemeIndex + 1));


// --- Main Loop ---
function loop() {
  const now = Date.now();
  const elapsedTime = now - startTime;

  // Stage Management
  if (currentStage === CONFIG.STAGES.INIT) {
    if (elapsedTime > CONFIG.DURATIONS.INIT) {
      currentStage = CONFIG.STAGES.FORM_TEXT;
      // Reset start time? No, stageTime is continuous in the prompt design
      // "stageTime is frame increments" - actually prompt said "stageTime은 프레임마다 증가"
      // But usually absolute time is easier for sync.
      // Let's use continuous flow but mark transition points if needed.
    }
  } else if (currentStage === CONFIG.STAGES.GAME) {
    if (gamePlaying && now - lastGameTick > GAME_TICK_RATE) {
      updateGame();
      lastGameTick = now;
    }
  } else if (currentStage === CONFIG.STAGES.FORM_TEXT) {
    if (elapsedTime > CONFIG.DURATIONS.INIT + CONFIG.DURATIONS.FORM_TEXT) {
      currentStage = CONFIG.STAGES.IDLE;
    }
  }

  // Render
  const theme = THEMES[currentThemeIndex];
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height); // usage of clearRect creates transparent canvas, we want BG color
  // ctx.clearRect(0, 0, width, height); <-- replaced

  // Optimization: Don't use forEach for massive arrays if perf is bad, but 
  // for < 10000 dots it's usually okay on modern JS.
  // 1920 / 14 ~ 137 cols, 1080 / 14 ~ 77 rows => ~10k dots.

  const count = dots.length;
  for (let i = 0; i < count; i++) {
    dots[i].update(now, elapsedTime);
    dots[i].draw(ctx);
  }

  requestAnimationFrame(loop);
}

// Start
init();
