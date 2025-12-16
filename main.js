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
  FONT_FAMILY: "Space Grotesk, sans-serif",
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
  { name: 'dark', bg: '#000000', dot: '#ffffff', shape: 'circle', missionBg: '#000000', missionText: '#ffffff', headerBg: 'rgba(0, 0, 0, 0.7)' },
  { name: 'light', bg: '#ffffff', dot: '#000000', shape: 'circle', missionBg: '#ffffff', missionText: '#000000', headerBg: 'rgba(255, 255, 255, 0.7)' },
  { name: 'lcd', bg: '#bad24c', dot: '#94ab26', shape: 'square', missionBg: '#bad24c', missionText: '#3b421b', headerBg: 'rgba(186, 210, 76, 0.8)' }
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

    // Fixed Dark Theme for Hero
    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;

    // Better color handling:
    // We already use opacity property.
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = FIXED_HERO_THEME.dot;

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
  if (window.scrollY > 100) {
    // If we are scrolled down, ignore Hero interactions
    // Move pointer off screen to stop hover effects
    mouse.x = -9999;
    mouse.y = -9999;
    return;
  }
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

  // --- Orbit Rotation Linked to Scroll ---
  const orbitContainer = document.getElementById('awards-orbit');
  if (orbitContainer) {
    // Wrap in RAF for performance
    requestAnimationFrame(() => {
      // Rotation factor: 1px scroll = 0.2 deg rotation
      const rotation = scrollY * 0.2;
      orbitContainer.style.transform = `rotate(${rotation}deg)`;

      const bubbles = orbitContainer.querySelectorAll('.award-bubble');
      bubbles.forEach(bubble => {
        // Maintain centering translate (-50%, -50%) AND apply counter rotation
        bubble.style.transform = `translate(-50%, -50%) rotate(${-rotation}deg)`;
      });
    });
  }

  // --- Marquee Logic ---
  const marqueeTrack = document.querySelector('.marquee-track');
  if (marqueeTrack) {
    const speed = 1.5;
    // Calculate offset. We want it to move LEFT as we scroll DOWN?
    // "좌우로 스크롤되게 해" -> Scroll horizontally.
    // Usually dragging down -> text moves left.

    // Infinite loop math:
    // We need to know the width of the content to loop it.
    // Let's assume the HTML is static for now or has been duplicated enough.
    // To make it truly infinite without gaps, we'd need to duplicate programmatically.
    // Let's do a simple transform for now, and if needed, I'll add duplication in init.

    // Simple Scroll Link
    marqueeTrack.style.transform = `translateX(${-scrollY * speed}px)`;
  }

  // Hide Scroll Prompt
  const prompt = document.getElementById('scroll-prompt');
  if (prompt) {
    if (scrollY > 50) {
      prompt.style.opacity = '0';
      prompt.style.transform = 'translate(-50%, 20px)'; // Slide down slightly
    } else {
      prompt.style.opacity = '1';
      prompt.style.transform = 'translate(-50%, 0)';
    }
  }

  // --- Dynamic Color Inversion ---
});

// --- Game Logic ---
function enterGameMode() {
  if (currentStage === CONFIG.STAGES.GAME) return;
  currentStage = CONFIG.STAGES.GAME;
  const controls = document.getElementById('game-controls');
  if (controls) controls.classList.add('active');

  // Convert current text state to alive if not already
  // (Handled in mapText, but if we want to reset to text state we can)
}

function exitGameMode() {
  currentStage = CONFIG.STAGES.IDLE; // Or reform text?
  gamePlaying = false;

  const controls = document.getElementById('game-controls');
  if (controls) controls.classList.remove('active');

  const btnPlay = document.getElementById('btn-play');
  const btnPause = document.getElementById('btn-pause');

  if (btnPlay) btnPlay.style.display = 'block';
  if (btnPause) btnPause.style.display = 'none';

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

if (btnPlay) {
  btnPlay.addEventListener('click', () => {
    gamePlaying = true;
    btnPlay.style.display = 'none';
    btnPause.style.display = 'block';
  });
}

if (btnPause) {
  btnPause.addEventListener('click', () => {
    gamePlaying = false;
    btnPlay.style.display = 'block';
    btnPause.style.display = 'none';
  });
}

if (btnReset) {
  btnReset.addEventListener('click', () => {
    // Kill all
    dots.forEach(d => d.alive = false);
    gamePlaying = false;
    if (btnPlay) btnPlay.style.display = 'block';
    if (btnPause) btnPause.style.display = 'none';
  });
}

if (btnClose) {
  btnClose.addEventListener('click', exitGameMode);
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
    const response = await fetch('awards.json?v=' + AppConfig.VERSION);
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
  initFooterAnimation();

  // Marquee logic
  const track = document.querySelector('.marquee-track');
  if (track) {
    // Setup scrolling
  }
});

async function loadMenu() {
  try {
    const response = await fetch('menu.json?v=' + AppConfig.VERSION);
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

// --- Footer Animation ---
function initFooterAnimation() {
  const footerText = document.getElementById('footer-text');
  if (!footerText) return;

  const words = ["MONAD LEADS THE FUTURE", "Ⓒ MONAD 2025~", "MONAD IS IN DIMIGO", "FOR HUMANITY", "JOIN MONAD"];
  let currentIndex = 0;

  setInterval(() => {
    // Fade Out
    footerText.style.opacity = '0';
    footerText.style.transform = 'translateY(10px) scale(0.95)'; // Subtle drop effect

    setTimeout(() => {
      // Change Text
      currentIndex = (currentIndex + 1) % words.length;
      footerText.textContent = words[currentIndex];

      // Fade In
      footerText.style.opacity = '1';
      footerText.style.transform = 'translateY(0) scale(1)';
    }, 500); // Wait for transition

  }, 2500); // Cycle every 2.5s
}
