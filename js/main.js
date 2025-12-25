const CONFIG = {
  SPACING: 18,      // Grid spacing (px) - Increased for lower density
  BASE_RADIUS: 3.0, // Base dot radius - Increased
  MAX_RADIUS: 8,    // Max radius on hover
  TEXT: "MONAD",
  FONT_SIZE: 400,   // px - Doubled size
  FONT_FAMILY: "Space Grotesk, sans-serif",
  NOISE_SCALE: 0.005,
  STAGES: {
    INIT: 0,
    FORM_TEXT: 1,
    GAME: 3 // New Stage
  },
  GAME_MODES: {
    TETRIS: 'tetris',
    LIFE: 'life',
    DOOM: 'doom',
    APPLE: 'apple'
  },
  DURATIONS: {
    INIT: 1800,      // ms
    FORM_TEXT: 1200  // ms
  }
};

const THEMES = [
  { name: 'dark', bg: '#000000', dot: '#ffffff', shape: 'circle', missionBg: '#000000', missionText: '#ffffff', headerBg: 'rgba(0, 0, 0, 0.7)' },
  { name: 'light', bg: '#ffffff', dot: '#000000', shape: 'circle', missionBg: '#ffffff', missionText: '#000000', headerBg: 'rgba(255, 255, 255, 0.7)' },
  { name: 'lcd', bg: '#bad24c', dot: '#94ab26', shape: 'square', missionBg: '#bad24c', missionText: '#3b421b', headerBg: 'rgba(186, 210, 76, 0.8)' }
];
// Config Extension for Game Modes
if (!CONFIG.GAME_MODES) {
  CONFIG.GAME_MODES = {
    TETRIS: 'tetris',
    LIFE: 'life',
    DOOM: 'doom',
    APPLE: 'apple',
    RICK: 'rick'
  };
} else {
  CONFIG.GAME_MODES.RICK = 'rick';
}

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
// --- Global State ---
let canvas = document.getElementById('dot-canvas');
let ctx = canvas ? canvas.getContext('2d') : null;

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

// Resolution Scaling
let currentGridSpacing = CONFIG.SPACING;
let targetGridSpacing = CONFIG.SPACING;
let brushSizeMultiplier = 1.0; // Brush Size State

// Lyrics State
let lyricsData = null; // Array of {time, text}
let currentLyricIndex = -1;
let isFetchingLyrics = false;




// --- Dot Class ---
class Dot {
  constructor(x, y, col, row) {
    this.x = x;
    this.y = y;
    this.col = col;
    this.row = row;

    this.alive = false;
    this.nextAlive = false;
    this.color = null; // Add color support

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
      // Tetris Rendering
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

    ctx.globalAlpha = this.opacity;

    // Check if color is set (for Tetris)
    if (this.color) {
      ctx.fillStyle = this.color;
    } else {
      ctx.fillStyle = FIXED_HERO_THEME.dot;
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.abs(this.radius), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0; // Reset
  }
}
// ...
// ...
// ... Init changes:
// ... Init changes:
function init() {
  // Try to get canvas again if it wasn't there initially (unlikely but safe)
  canvas = document.getElementById('dot-canvas');
  if (canvas) {
    ctx = canvas.getContext('2d');
    resize();
    createGrid();
    mapText();
    loop(); // Only loop if we have canvas
  }

  // Start
  // setTheme removed
  loadMenu().then(() => {
    // Setup Mobile Menu Logic after menu loads (or concurrently, elements exist)
    const toggleBtn = document.getElementById('menu-toggle');
    const nav = document.getElementById('main-nav');

    if (toggleBtn && nav) {
      toggleBtn.addEventListener('click', () => {
        nav.classList.toggle('active');
        toggleBtn.classList.toggle('active');
      });

      // Close on link click
      nav.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          nav.classList.remove('active');
          toggleBtn.classList.remove('active');
        });
      });
    }
  });
  loadAwards();
}


function resize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;

  // Logical size
  width = window.innerWidth;
  height = window.innerHeight;

  // Calculate Visual Scale
  // Mobile fix: "MONAD" text width needs to fit or be reasonably cropped.
  // 5 chars approx.
  // Let's rely on a more linear scale for mobile.
  if (width < 600) {
    // Drastically reduce for mobile to prevent overflow
    visualScale = width / 1500;
  } else {
    visualScale = Math.max(width / 1920, 0.5);
  }

  // Physical size
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  // CSS size
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  // Normalize coordinate system
  ctx.scale(dpr, dpr);
}

function createGrid(spacingOverride = null) {
  dots = [];
  grid = [];
  // Use override if provided, else use current global spacing logic (which might be animating)
  let baseSpacing = spacingOverride || currentGridSpacing;
  const spacing = baseSpacing * visualScale;

  cols = Math.ceil(width / spacing);
  rows = Math.ceil(height / spacing);

  for (let r = 0; r < rows; r++) {
    const rowArr = [];
    for (let c = 0; c < cols; c++) {
      const x = c * spacing + spacing / 2; // Center offset
      const y = r * spacing + spacing / 2;

      const dot = new Dot(x, y, c, r);
      // If dense mode, reduce radius
      if (baseSpacing < CONFIG.SPACING) {
        dot.baseRadius = (CONFIG.BASE_RADIUS * visualScale) * (baseSpacing / CONFIG.SPACING);
        dot.radius = dot.baseRadius;
      }

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

// --- Tetris Global ---
let tetris = null;
if (typeof TetrisGame !== 'undefined') {
  tetris = new TetrisGame();
}
let lastDropTime = 0;
const DROP_INTERVAL = 1000; // Auto drop every 1s

// --- Interaction ---
window.addEventListener('resize', () => {
  resize();
  createGrid();
  mapText();
});

window.addEventListener('mousemove', e => {
  if (window.scrollY > 100) {
    mouse.x = -9999;
    mouse.y = -9999;
    return;
  }
  mouse.x = e.clientX;
  mouse.y = e.clientY;

  // Drag to paint Logic
  // Only trigger if we are starting from IDLE or already in LIFE mode
  if (isMouseDown && (currentStage === CONFIG.STAGES.IDLE || (currentStage === CONFIG.STAGES.GAME && currentGameMode === CONFIG.GAME_MODES.LIFE))) {

    // Switch to LIFE mode if not already
    if (currentStage !== CONFIG.STAGES.GAME || currentGameMode !== CONFIG.GAME_MODES.LIFE) {
      enterGameMode(CONFIG.GAME_MODES.LIFE);
    }

    // Paint logic
    const spacing = CONFIG.SPACING * visualScale;
    const paintRadius = spacing * brushSizeMultiplier; // Apply Brush Size
    let aliveCount = 0;
    dots.forEach(dot => {
      const dx = dot.x - mouse.x;
      const dy = dot.y - mouse.y;
      if (dx * dx + dy * dy < (paintRadius * paintRadius)) { // Use new radius
        dot.alive = true;
        dot.opacity = 1;
        // dot.color is null for LIFE
      }
      if (dot.alive) aliveCount++;
    });

    // Check Trigger Condition: > 98% alive
    if (aliveCount / dots.length > 0.98) {
      if (currentGameMode !== CONFIG.GAME_MODES.RICK) {
        enterGameMode(CONFIG.GAME_MODES.RICK);
      }
    }
  }
});

// --- Lyrics Logic ---
const RICK_LYRICS = `[00:19.67] We're no strangers to love
[00:23.56] You know the rules and so do I (do I)
[00:27.92] A full commitment's what I'm thinking of
[00:32.11] You wouldn't get this from any other guy
[00:36.05] I just wanna tell you how I'm feeling
[00:41.34] Gotta make you understand
[00:43.18] Never gonna give you up
[00:45.25] Never gonna let you down
[00:47.29] Never gonna run around and desert you
[00:51.52] Never gonna make you cry
[00:53.78] Never gonna say goodbye
[00:55.73] Never gonna tell a lie and hurt you
[01:00.98] We've known each other for so long
[01:04.96] Your heart's been aching, but you're too shy to say it (say it)
[01:09.23] Inside, we both know what's been going on (going on)
[01:13.67] We know the game and we're gonna play it
[01:17.57] And if you ask me how I'm feeling
[01:22.45] Don't tell me you're too blind to see
[01:25.46] Never gonna give you up
[01:27.56] Never gonna let you down
[01:29.75] Never gonna run around and desert you
[01:33.96] Never gonna make you cry
[01:36.22] Never gonna say goodbye
[01:38.29] Never gonna tell a lie and hurt you
[01:42.33] Never gonna give you up
[01:44.45] Never gonna let you down
[01:46.64] Never gonna run around and desert you
[01:50.98] Never gonna make you cry
[01:52.83] Never gonna say goodbye
[01:55.13] Never gonna tell a lie and hurt you
[01:59.85] (Ooh, give you up)
[02:04.01] (Ooh, give you up)
[02:08.58] (Ooh) Never gonna give, never gonna give (give you up)
[02:12.58] (Ooh) Never gonna give, never gonna give (give you up)
[02:17.02] We've known each other for so long
[02:21.23] Your heart's been aching, but you're too shy to say it (to say it)
[02:25.52] Inside, we both know what's been going on (going on)
[02:29.81] We know the game and we're gonna play it
[02:33.90] I just wanna tell you how I'm feeling
[02:39.11] Gotta make you understand
[02:41.73] Never gonna give you up
[02:43.97] Never gonna let you down
[02:45.95] Never gonna run around and desert you
[02:50.22] Never gonna make you cry
[02:52.22] Never gonna say goodbye
[02:54.38] Never gonna tell a lie and hurt you
[02:58.59] Never gonna give you up
[03:00.70] Never gonna let you down
[03:02.83] Never gonna run around and desert you
[03:07.26] Never gonna make you cry
[03:09.26] Never gonna say goodbye
[03:11.39] Never gonna tell a lie and hurt you
[03:15.52] Never gonna give you up
[03:17.68] Never gonna let you down
[03:19.88] Never gonna run around and desert you
[03:24.06] Never gonna make you cry
[03:26.23] Never gonna say goodbye
[03:28.34] Never gonna tell a lie and hurt you`;

function parseLyrics(lrcString) {
  const lines = lrcString.split('\n');
  const parsed = [];
  const timeReg = /\[(\d{2}):(\d{2})\.(\d{2})\]/;

  lines.forEach(line => {
    const match = timeReg.exec(line);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const cs = parseInt(match[3]);
      const time = min * 60 + sec + cs / 100;
      const text = line.replace(timeReg, '').trim();
      if (text) {
        parsed.push({ time, text });
      }
    }
  });
  lyricsData = parsed;
  // console.log("Parsed Lyrics:", lyricsData);
}


let isMouseDown = false;
window.addEventListener('mousedown', () => isMouseDown = true);
window.addEventListener('mouseup', () => isMouseDown = false);

// Key Listener for Game Start & Control
window.addEventListener('keydown', (e) => {
  // Brush Size Control (Global)
  if (e.code === "BracketLeft") {
    brushSizeMultiplier = Math.max(0.5, brushSizeMultiplier - 2.0); // Faster decrease
    console.log("Brush Size:", brushSizeMultiplier);
  }
  if (e.code === "BracketRight") {
    brushSizeMultiplier = Math.min(100.0, brushSizeMultiplier + 2.0); // Faster increase, Max 100
    console.log("Brush Size:", brushSizeMultiplier);
  }

  // Cheat Codes
  if (e.code === konamiCode[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === konamiCode.length) {
      triggerKonami();
      konamiIndex = 0;
    }
  } else {
    konamiIndex = 0;
  }

  // DOOM Code
  if (e.code === doomCode[doomIndex]) {
    doomIndex++;
    if (doomIndex === doomCode.length) {
      enterGameMode(CONFIG.GAME_MODES.DOOM);
      doomIndex = 0;
    }
  } else {
    doomIndex = 0;
  }

  // APPLE Code
  if (e.code === appleCode[appleIndex]) {
    appleIndex++;
    if (appleIndex === appleCode.length) {
      enterGameMode(CONFIG.GAME_MODES.APPLE);
      appleIndex = 0;
    }
  } else {
    appleIndex = 0;
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].indexOf(e.code) > -1) {
    if (currentStage === CONFIG.STAGES.GAME || window.scrollY < 100) {
      e.preventDefault();
    }
  }

  // Trigger Tetris on keys
  if (currentStage !== CONFIG.STAGES.GAME) {
    if (window.scrollY < 100 && (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW")) {
      enterGameMode(CONFIG.GAME_MODES.TETRIS);
    }
    return;
  }

  // If in LIFE mode, maybe switching to Tetris on keypress?
  // Let's allow it.
  if (currentGameMode === CONFIG.GAME_MODES.LIFE && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].indexOf(e.code) > -1) {
    enterGameMode(CONFIG.GAME_MODES.TETRIS);
    return;
  }

  // Pass to Doom
  if (currentGameMode === CONFIG.GAME_MODES.DOOM) {
    if (window.doomAdapter) {
      window.doomAdapter.handleKeyDown(e.code);
    }
    // Prevent default for common game keys
    const doomKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ControlLeft", "MetaLeft", "AltLeft", "AltRight", "KeyW", "KeyA", "KeyS", "KeyD", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7"];
    if (doomKeys.includes(e.code)) {
      e.preventDefault();
    }
    return;
  }

  // Pass to Tetris
  if (!gamePlaying || currentGameMode !== CONFIG.GAME_MODES.TETRIS) return;

  if (tetris) {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        tetris.move(-1, 0);
        break;
      case "ArrowRight":
      case "KeyD":
        tetris.move(1, 0);
        break;
      case "ArrowUp":
      case "KeyW":
      case "KeyX":
        tetris.rotatePiece();
        break;
      case "KeyZ":
      case "ControlLeft":
      case "ControlRight":
        tetris.rotatePieceCCW();
        break;
      case "ArrowDown":
      case "KeyS":
        tetris.softDrop();
        break;
      case "Space":
        tetris.hardDrop();
        break;
    }
    // Force immediate update of grid visual
    tetris.updateGrid(dots, cols, rows);
  }

});

// KeyUp Listener for Doom
window.addEventListener('keyup', (e) => {
  if (currentGameMode === CONFIG.GAME_MODES.DOOM) {
    if (window.doomAdapter) {
      window.doomAdapter.handleKeyUp(e.code);
    }
  }
});


window.addEventListener('scroll', () => {
  scrollY = window.scrollY;
  // Exit game mode on scroll
  if (scrollY > 100 && currentStage === CONFIG.STAGES.GAME) {
    exitGameMode(); // Auto exit
  }

  // --- Orbit Rotation Linked to Scroll ---
  const orbitContainer = document.getElementById('awards-orbit');
  if (orbitContainer) {
    requestAnimationFrame(() => {
      const rotation = scrollY * 0.2;
      orbitContainer.style.transform = `rotate(${rotation}deg)`;
      const bubbles = orbitContainer.querySelectorAll('.award-bubble');
      bubbles.forEach(bubble => {
        bubble.style.transform = `translate(-50%, -50%) rotate(${-rotation}deg)`;
      });
    });
  }

  // --- Marquee Logic ---
  const marqueeTrack = document.querySelector('.marquee-track');
  if (marqueeTrack) {
    const speed = 1.5;
    marqueeTrack.style.transform = `translateX(${-scrollY * speed}px)`;
  }

  // Hide Scroll Prompt
  const prompt = document.getElementById('scroll-prompt');
  if (prompt) {
    if (scrollY > 50) {
      prompt.style.opacity = '0';
      prompt.style.transform = 'translate(-50%, 20px)';
    } else {
      prompt.style.opacity = '1';
      prompt.style.transform = 'translate(-50%, 0)';
    }
  }
});

// Assuming CONFIG object is defined earlier in the file.
// Adding new properties to CONFIG.STAGES and defining GAME_MODES.


// ... (Existing variables) ...
let currentGameMode = CONFIG.GAME_MODES.TETRIS;

// ... (Dot Class changes if needed, mainly in update logic handled by mode) ...
// Dot update logic already checks STAGES.GAME. We might need to check currentGameMode inside it 
// or just let updateGame handle the physics/logic and Dot render based on state.
// Current Dot.update ignores physics in GAME mode mostly. 
// For LIFE mode, we might want physics? Or just grid logic.
// Original Code had physics in updateGame? No, Dot.update had physics.
// Let's modify Dot.update to handle LIFE mode physics if needed, 
// but primarily LIFE is cellular automata.

// --- Game Logic Switcher ---
const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"];
let konamiIndex = 0;
const doomCode = ["KeyD", "KeyO", "KeyO", "KeyM"];
let doomIndex = 0;

const appleCode = ["KeyA", "KeyP", "KeyP", "KeyL", "KeyE"];
let appleIndex = 0;

function enterGameMode(mode) {
  currentStage = CONFIG.STAGES.GAME; // Keep this from original
  currentGameMode = mode;
  gamePlaying = true; // Default to true

  // Hide Controls initially
  btnPlay.style.display = 'none';
  btnPause.style.display = 'none';
  btnReset.style.display = 'none';

  const controls = document.getElementById('game-controls');
  if (controls) controls.classList.add('active');

  const btnHelp = document.getElementById('btn-help');
  if (btnHelp) btnHelp.style.display = (mode === CONFIG.GAME_MODES.DOOM) ? 'block' : 'none';

  if (mode === CONFIG.GAME_MODES.TETRIS) {
    if (tetris) {
      targetGridSpacing = CONFIG.SPACING; // Standard
      tetris.start(); // This sets tetris.isRunning = true
      // Show only Reset for Tetris? or nothing?
      btnReset.style.display = 'block';
    }
  } else if (mode === CONFIG.GAME_MODES.LIFE) {
    // Only rebuild if resolution is different (e.g. from Doom)
    if (currentGridSpacing !== CONFIG.SPACING) {
      targetGridSpacing = CONFIG.SPACING;
      currentGridSpacing = CONFIG.SPACING;
      createGrid();
    } else {
      // Preserve current text dots by marking them 'alive' for GOL
      dots.forEach(d => {
        if (d.isText) {
          d.alive = true;
          d.opacity = 1;
        }
      });
    }

    gamePlaying = false; // Start paused
    btnPlay.style.display = 'block';
    btnReset.style.display = 'block';
  } else if (mode === CONFIG.GAME_MODES.DOOM) {
    targetGridSpacing = 10; // Restore more dramatic resolution

    // Initialize Doom
    if (window.doomAdapter) {
      window.doomAdapter.init();
    }
  } else if (mode === CONFIG.GAME_MODES.APPLE) {
    targetGridSpacing = 10; // High resolution for video
    const video = document.getElementById('bad-apple-video');
    if (video) {
      video.currentTime = 0;
      video.play();
    }
  } else if (mode === CONFIG.GAME_MODES.RICK) {
    targetGridSpacing = 10; // High resolution for video
    const video = document.getElementById('rick-video');
    if (video) {
      video.currentTime = 0;
      video.volume = 1.0;
      video.play().catch(e => {
        console.log("Autoplay blocked, waiting for interaction", e);
        // Fallback: maybe show a "Click to Start" overlay or just rely on the next click?
        // Since user is dragging, interaction is continuous, so it might just work on next frame or logic tick.
      });

      // Setup Lyrics UI
      const lyricEl = document.getElementById('lyrics-container');
      if (lyricEl) lyricEl.classList.add('active');
      const header = document.getElementById('main-header');
      if (header) header.classList.add('lyrics-mode');

      // Parse Hardcoded Lyrics immediately
      if (!lyricsData) {
        parseLyrics(RICK_LYRICS);
      }
      currentLyricIndex = -1;
    }
  }
}


function exitGameMode() {
  currentStage = CONFIG.STAGES.IDLE;
  gamePlaying = false;
  if (tetris) tetris.pause();

  if (currentGameMode === CONFIG.GAME_MODES.DOOM && window.doomAdapter) {
    window.doomAdapter.stop();
  }

  if (currentGameMode === CONFIG.GAME_MODES.APPLE) {
    const video = document.getElementById('bad-apple-video');
    if (video) video.pause();
  }

  if (currentGameMode === CONFIG.GAME_MODES.RICK) {
    const video = document.getElementById('rick-video');
    if (video) video.pause();
    const lyricEl = document.getElementById('lyrics-container');
    if (lyricEl) lyricEl.classList.remove('active');
    const header = document.getElementById('main-header');
    if (header) header.classList.remove('lyrics-mode');
  }

  currentGameMode = null; // Clear mode
  targetGridSpacing = CONFIG.SPACING;

  const controls = document.getElementById('game-controls');
  if (controls) controls.classList.remove('active');

  const scoreEl = document.getElementById('game-score');
  if (scoreEl) scoreEl.style.opacity = '1';

  const btnPlay = document.getElementById('btn-play');
  const btnPause = document.getElementById('btn-pause');
  if (btnPlay) btnPlay.style.display = 'block';
  if (btnPause) btnPause.style.display = 'none';

  const btnHelp = document.getElementById('btn-help');
  if (btnHelp) btnHelp.style.display = 'none';
  const modal = document.getElementById('help-modal');
  if (modal) modal.classList.remove('active');

  // Restore logo only if spacing is already correct.
  // Otherwise, let the loop's transition snap handle it to avoid "ghosting" across resolutions.
  if (Math.abs(currentGridSpacing - targetGridSpacing) < 0.01) {
    currentGridSpacing = targetGridSpacing; // Snap
    createGrid(); // Clear game state and initialize new dots
    mapText();
  } else {
    // Clear current dots state so they don't look like "text" or "game" during transition
    dots.forEach(d => {
      d.alive = false;
      d.isText = false;
      d.color = null;
      d.opacity = 0;
    });
  }
}

function updateGame(elapsedTime, deltaTime) {
  if (!gamePlaying) return;

  if (currentGameMode === CONFIG.GAME_MODES.TETRIS) {
    if (tetris) {
      // Dynamic Drop Interval based on level
      // Base 200ms (Very Fast!) -> decreases by 10ms per level -> min 50ms
      const currentInterval = Math.max(50, 200 - (tetris.level * 10));

      // Auto Drop
      if (elapsedTime - lastDropTime > currentInterval) {
        tetris.drop();
        lastDropTime = elapsedTime;
      }
      // Sync Visuals
      tetris.updateGrid(dots, cols, rows);
    }
  } else if (currentGameMode === CONFIG.GAME_MODES.DOOM) {
    if (window.doomAdapter) {
      if (window.doomAdapter.error) {
        // Render Error Text
        if (tetris) {
          const centerX = Math.floor(cols / 2);
          const centerY = Math.floor(rows / 2);
          tetris.drawText(dots, cols, rows, "MISSING", centerX - 14, centerY - 8, '#ff0000');
          tetris.drawText(dots, cols, rows, "DOOM", centerX - 8, centerY, '#ff0000');
          tetris.drawText(dots, cols, rows, "ZIP", centerX - 6, centerY + 8, '#ff0000');
        }
      } else {

        // Throttle Doom Rendering to 30 FPS to save CPU/Input latency
        const now = Date.now();
        if (now - lastGameTick > 33) {
          window.doomAdapter.update();
          const frameData = window.doomAdapter.getFrame(cols, rows);
          if (frameData) {
            // Render Doom Frame to Dots
            for (let y = 0; y < rows; y++) {
              for (let x = 0; x < cols; x++) {
                const i = (y * cols + x) * 4;
                const r = frameData[i];
                const g = frameData[i + 1];
                const b = frameData[i + 2];

                const dot = dots[y * cols + x];
                if (dot) {
                  dot.alive = true;
                  dot.color = `rgb(${r},${g},${b})`;
                  dot.opacity = 1;
                }
              }
            }
          }
          lastGameTick = now;
        }
      }
    }
  }
  else if (currentGameMode === CONFIG.GAME_MODES.APPLE) {
    const video = document.getElementById('bad-apple-video');
    if (video && !video.paused) {
      // 1. Create Offscreen Canvas to sample video
      const sampleCanvas = document.createElement('canvas');
      const sampleCtx = sampleCanvas.getContext('2d');
      sampleCanvas.width = cols;
      sampleCanvas.height = rows;

      // 2. Draw Video to Canvas (resized to grid dimensions)
      sampleCtx.drawImage(video, 0, 0, cols, rows);

      // 3. Sample Pixels
      const pixelData = sampleCtx.getImageData(0, 0, cols, rows).data;

      // 4. Update Dots
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          // Sample brightness (R+G+B / 3)
          const brightness = (pixelData[i] + pixelData[i + 1] + pixelData[i + 2]) / 3;
          const dot = dots[y * cols + x];
          if (dot) {
            dot.alive = brightness > 128; // Threshold
            dot.opacity = dot.alive ? 1 : 0;
            dot.color = dot.alive ? '#ffffff' : null;
          }
        }
      }
    }
  } else if (currentGameMode === CONFIG.GAME_MODES.RICK) {
    const video = document.getElementById('rick-video');
    if (video && !video.paused) {
      // --- Lyrics Update ---
      if (lyricsData) {
        const LYRIC_OFFSET = 0.5; // Seconds to advance lyrics ("make them faster")
        const t = video.currentTime + LYRIC_OFFSET;
        // Simple search (can be optimized but array is small)
        // We want the last lyric where time <= t
        let activeIdx = -1;
        for (let i = 0; i < lyricsData.length; i++) {
          if (lyricsData[i].time <= t) {
            activeIdx = i;
          } else {
            break;
          }
        }

        if (activeIdx !== currentLyricIndex) {
          currentLyricIndex = activeIdx;
          const lyricEl = document.getElementById('lyrics-container');
          if (lyricEl && activeIdx > -1) {
            lyricEl.innerText = lyricsData[activeIdx].text;
          } else if (lyricEl) {
            lyricEl.innerText = "";
          }
        }
      }

      // Same rendering logic as APPLE
      const sampleCanvas = document.createElement('canvas');
      const sampleCtx = sampleCanvas.getContext('2d');
      sampleCanvas.width = cols;
      sampleCanvas.height = rows;

      sampleCtx.drawImage(video, 0, 0, cols, rows);
      const pixelData = sampleCtx.getImageData(0, 0, cols, rows).data;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const dot = dots[y * cols + x];
          if (dot) {
            // Color Video Support
            const r = pixelData[i];
            const g = pixelData[i + 1];
            const b = pixelData[i + 2];

            const brightness = (r + g + b) / 3;

            dot.alive = brightness > 30;
            if (dot.alive) {
              dot.color = `rgb(${r},${g},${b})`;
              dot.opacity = 1;
            } else {
              dot.opacity = 0;
            }
          }
        }
      }
    }
  } else {
    // LIFE GAME LOGIC
    // Slow down update rate for Life? 
    // Logic handles this if we use LAST_TICK check in loop()

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
            // Wrap around or boundary? Boundary for now.
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
    dots.forEach(dot => {
      dot.alive = dot.nextAlive;
      dot.color = null; // Reset color for Life mode (white/default)
      // Life visuals handled in Dot.update (targetOpacity = 1 if alive)
    });
  }
}

// --- UI Binding ---
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnClose = document.getElementById('btn-close');

if (btnPlay) {
  btnPlay.addEventListener('click', () => {
    gamePlaying = true;
    if (currentGameMode === CONFIG.GAME_MODES.TETRIS && tetris) {
      tetris.resume();
    }
    btnPlay.style.display = 'none';
    btnPause.style.display = 'block';
  });
}

if (btnPause) {
  btnPause.addEventListener('click', () => {
    gamePlaying = false;
    if (currentGameMode === CONFIG.GAME_MODES.TETRIS && tetris) {
      tetris.pause();
    }
    btnPlay.style.display = 'block';
    btnPause.style.display = 'none';
  });
}

if (btnReset) {
  btnReset.addEventListener('click', () => {
    if (currentGameMode === CONFIG.GAME_MODES.TETRIS && tetris) {
      tetris.start();
      gamePlaying = true;
      btnPlay.style.display = 'none';
      btnPause.style.display = 'block';
    } else {
      // LIFE MODE RESET: Clear board
      dots.forEach(d => {
        d.alive = false;
        d.opacity = 0;
        d.nextAlive = false;
      });
      gamePlaying = false; // Pause on reset?
      btnPlay.style.display = 'block';
      btnPause.style.display = 'none';
    }
  });
}

if (btnClose) {
  btnClose.addEventListener('click', exitGameMode);
}

const btnHelp = document.getElementById('btn-help');
const modal = document.getElementById('help-modal');
const modalClose = document.querySelector('.modal-close');

if (btnHelp && modal) {
  btnHelp.addEventListener('click', () => {
    modal.classList.add('active');
  });
}

if (modal && modalClose) {
  modalClose.addEventListener('click', () => {
    modal.classList.remove('active');
  });
}

// Close modal on click outside
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

// --- Theme Logic ---
// --- Theme Logic (Refactored to Fixed Layout) ---
// Hero is always Dark (0), Content is Light, Awards is Dark.
// We only need to control the Canvas rendering style here.
const FIXED_HERO_THEME = {
  bg: '#000000',
  dot: '#ffffff',
  shape: 'circle'
};

// ... Removed manual theme switching ...

// ...
// Update draw() to use FIXED_HERO_THEME
// ...


// --- Awards Logic ---
async function loadAwards() {
  try {
    const response = await fetch('data/awards.json?v=' + AppConfig.VERSION);
    if (!response.ok) return; // Silent fail if no server
    const data = await response.json();

    // --- Orbit Render (Max 8) ---
    const orbitContainer = document.getElementById('awards-orbit');
    if (orbitContainer) {
      orbitContainer.innerHTML = '';
      const orbitData = data.slice(0, 8);
      const total = orbitData.length;
      const radius = 300; // px

      orbitData.forEach((award, index) => {
        const bubble = document.createElement('div');
        bubble.classList.add('award-bubble');
        // Ensure text color is inherited correctly or explicit if needed 
        // (style.css handled inheritance)
        bubble.innerHTML = `
                    <strong>${award.title}</strong>
                    <span>${award.org} • ${award.year}</span>
                `;

        const angle = (index / total) * Math.PI * 2;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        bubble.style.left = '50%';
        bubble.style.top = '50%';
        bubble.style.marginLeft = `${x}px`;
        bubble.style.marginTop = `${y}px`;

        orbitContainer.appendChild(bubble);
      });
    }

    // --- List Render (The Rest) ---
    const listContainer = document.getElementById('awards-list');
    if (listContainer) {
      listContainer.innerHTML = '';
      const listData = data; // Show all items

      if (listData.length === 0) {
        listContainer.style.display = 'none';
      } else {
        listContainer.style.display = 'flex';
        listData.forEach(award => {
          const card = document.createElement('div');
          card.classList.add('award-card');
          card.innerHTML = `
                        <strong>${award.title}</strong>
                        <div class="award-details">
                            <p>${award.description || "Awarded for excellence in digital craft."}</p>
                            <span>${award.org} • ${award.year}</span>
                        </div>
                     `;
          card.addEventListener('click', () => {
            card.classList.toggle('active');
          });
          listContainer.appendChild(card);
        });
      }
    }

  } catch (e) {
    console.warn("Could not load awards (likely CORS):", e);
  }
}

// --- Text Effects (Hacker & Typewriter) ---
function initTextEffects() {
  const titles = document.querySelectorAll('.mission-content h2');
  const paragraphs = document.querySelectorAll('.mission-content p');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        if (target.tagName.toLowerCase() === 'h2') {
          animateHackerText(target);
        } else if (target.tagName.toLowerCase() === 'p') {
          animateTypewriter(target);
        }
        observer.unobserve(target); // Run ONCE
      }
    });
  }, { threshold: 0.5 });

  [...titles, ...paragraphs].forEach(t => {
    t.dataset.originalText = t.innerText;
    // For typewriter, hide text initially visually or keep it? 
    // Usually hide it, but to prevent layout shift, maybe set visibility: hidden? 
    // Or just set opacity 0 then animate? 
    // Better: set textContent empty but keep height? Hard.
    // Easiest: Set opacity 0 in CSS then in animate set opacity 1. 
    // But animate updates innerText.
    // I will explicitly set it to empty string here IF it's a paragraph.
    if (t.tagName.toLowerCase() === 'p') {
      t.style.minHeight = t.offsetHeight + 'px'; // Reserve height
      t.innerText = '';
    }
    observer.observe(t);
  });

  // Hacker Effect (Context-Aware) for Titles
  function animateHackerText(element) {
    const originalText = element.dataset.originalText;
    const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const LOWER = "abcdefghijklmnopqrstuvwxyz";
    const DIGITS = "0123456789";
    const SYMBOLS = "!@#$%^&*()_+~[]{}-=";

    let iteration = 0;

    // Clear existing
    clearInterval(element.dataset.intervalId);

    let interval = setInterval(() => {
      element.innerText = originalText
        .split("")
        .map((letter, index) => {
          if (index < iteration) return originalText[index];
          if (letter === " " || letter === "\n") return letter;

          if (UPPER.includes(letter)) return UPPER[Math.floor(Math.random() * UPPER.length)];
          if (LOWER.includes(letter)) return LOWER[Math.floor(Math.random() * LOWER.length)];
          if (DIGITS.includes(letter)) return DIGITS[Math.floor(Math.random() * DIGITS.length)];
          return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        })
        .join("");

      if (iteration >= originalText.length) clearInterval(interval);
      iteration += 1 / 2;
    }, 30);

    element.dataset.intervalId = interval;
  }

  // Typewriter Effect (Jaso Decomp) for Paragraphs
  function animateTypewriter(element) {
    const originalText = element.dataset.originalText;
    let index = 0;
    let currentText = "";

    // Simple recursive typer
    function type() {
      if (index >= originalText.length) return;

      const char = originalText[index];
      const code = char.charCodeAt(0);

      // Check if Hangul (AC00-D7A3)
      if (code >= 0xAC00 && code <= 0xD7A3) {
        const base = code - 0xAC00;
        const choIdx = Math.floor(base / 588);
        const jungIdx = Math.floor((base - (choIdx * 588)) / 28);
        const jongIdx = base % 28;

        // Recompose steps
        const step2 = String.fromCharCode(0xAC00 + (choIdx * 588) + (jungIdx * 28)); // Cho + Jung

        const steps = [];
        steps.push(step2);
        if (jongIdx > 0) {
          steps.push(String.fromCharCode(0xAC00 + (choIdx * 588) + (jungIdx * 28) + jongIdx));
        }

        let stepStep = 0;
        let jasoInterval = setInterval(() => {
          if (stepStep >= steps.length) {
            clearInterval(jasoInterval);
            currentText += char;
            element.innerText = currentText;
            index++;
            setTimeout(type, 5); // 3x Faster char delay (5ms)
          } else {
            element.innerText = currentText + steps[stepStep];
            stepStep++;
          }
        }, 7); // 3x Faster Jaso writing speed (7ms)

      } else {
        // Non-Hangul
        currentText += char;
        element.innerText = currentText;
        index++;
        setTimeout(type, 5); // 3x Faster English typing speed (5ms)
      }
    }

    type();
  }
}

// Call it
document.addEventListener('DOMContentLoaded', () => {
  // ... other inits ...
  loadMenu(); // Ensure menu loads
  loadAwards(); // Ensure awards load
  initTextEffects();


  // Marquee logic
  const track = document.querySelector('.marquee-track');
  if (track) {
    // Setup scrolling
  }
});

async function loadMenu() {
  try {
    const response = await fetch('data/menu.json?v=' + AppConfig.VERSION);
    if (!response.ok) return;
    const items = await response.json();

    const nav = document.getElementById('main-nav');
    if (!nav) return;

    nav.innerHTML = '';
    items.forEach(item => {
      const a = document.createElement('a');
      a.href = item.link;
      a.textContent = item.name;
      nav.appendChild(a);
    });
  } catch (e) {
    console.warn("Could not load menu:", e);
  }
}


// --- Main Loop ---
function loop() {
  if (!ctx) return;
  const now = Date.now();
  const elapsedTime = now - startTime;

  // Resolution Transition Logic
  if (Math.abs(targetGridSpacing - currentGridSpacing) > 0.01) {
    // Lerp
    currentGridSpacing += (targetGridSpacing - currentGridSpacing) * 0.1;
    createGrid(); // Rebuild grid at new spacing

    // FORCE IMMEDIATE UPDATE during transition to prevent flickering 
    // (Wait for 30fps throttle would leave the new dots empty/blank for multiple frames)
    if (currentGameMode === CONFIG.GAME_MODES.GAME || currentGameMode === CONFIG.GAME_MODES.DOOM) {
      updateGame(elapsedTime);
    }
  } else {
    // Snap only if close and not equal
    if (currentGridSpacing !== targetGridSpacing) {
      currentGridSpacing = targetGridSpacing;
      createGrid(); // Final snap

      // Force update on final snap too
      if (currentGameMode === CONFIG.GAME_MODES.GAME || currentGameMode === CONFIG.GAME_MODES.DOOM) {
        updateGame(elapsedTime);
      }

      // If we returned to standard spacing (NOT Doom), map text to restore logo
      if (targetGridSpacing === CONFIG.SPACING && currentStage !== CONFIG.STAGES.GAME) {
        mapText();
      }
    }
  }


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
      updateGame(elapsedTime);
      lastGameTick = now;
    }
  } else if (currentStage === CONFIG.STAGES.FORM_TEXT) {
    if (elapsedTime > CONFIG.DURATIONS.INIT + CONFIG.DURATIONS.FORM_TEXT) {
      currentStage = CONFIG.STAGES.IDLE;
    }
  }

  // Render
  // Hero is always black
  ctx.fillStyle = FIXED_HERO_THEME.bg;
  ctx.fillRect(0, 0, width, height);
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


