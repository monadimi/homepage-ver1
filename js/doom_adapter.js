class DoomAdapter {
  constructor() {
    this.dos = null;
    this.ci = null; // Command Interface
    this.canvas = document.createElement('canvas'); // Hidden canvas for DOSBox
    this.canvas.width = 320;
    this.canvas.height = 200;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.isRunning = false;
    this.imageData = null;
    this.error = null;

    // Input mapping (User custom layout)
    this.keyMap = {
      "ArrowUp": 38,    // Move Up
      "ArrowDown": 40,  // Move Down
      "ArrowLeft": 37,  // Turn Left
      "ArrowRight": 39, // Turn Right
      "KeyW": 32,       // Use (Map W to Space)
      "KeyS": 17,       // Fire (Map S to Ctrl)
      "Space": 16,      // Speed (Map Space to Shift)
      "AltLeft": 18,    // Strafe On
      "AltRight": 18,
      "KeyA": 188,      // Strafe Left (Map A to ,)
      "KeyD": 190,      // Strafe Right (Map D to .)
      "Digit1": 49,     // Weapons
      "Digit2": 50,
      "Digit3": 51,
      "Digit4": 52,
      "Digit5": 53,
      "Digit6": 54,
      "Digit7": 55,
      "Enter": 13,
      "Escape": 27
    };
    this.pressedKeys = new Set();
    this.keyPressTimes = new Map();
  }

  async init() {
    if (this.isRunning) return;

    // Ensure js-dos is loaded
    if (typeof Dos === 'undefined') {
      console.error("js-dos not loaded");
      return;
    }

    try {
      this.dos = Dos(this.canvas, {
        wdosboxUrl: "https://js-dos.com/6.22/current/wdosbox.js",
        cycles: "max", // Max performance
        autolock: false,
      });

      this.dos.ready((fs, main) => {
        fs.extract("assets/doom.zip").then(() => {
          // Try to launch Doom, handling potential subfolders
          main([
            "-c", "cls",
            "-c", "DOOM.EXE",         // Try root
            "-c", "cd DOOM",          // Try folder
            "-c", "DOOM.EXE",
            "-c", "cd ..",            // Back out
            "-c", "cd DOOM_SE",       // Try SE folder
            "-c", "DOOM.EXE",
            "-c", "echo GAME NOT FOUND OR CRASHED",
            "-c", "dir /w"            // Show dir for debug
          ]).then((ci) => {
            this.ci = ci;
            this.isRunning = true;
            console.log("Doom Started");

            // Disable default mouse capture if possible to avoid annoyance
            // ci.config ...?
          });
        }).catch(err => {
          console.error("Doom Zip Error:", err);
          this.error = "MISSING DOOM.ZIP";
          // alert("Doom file missing! Please place 'doom.zip' in 'assets/' folder.");
        });
      });
    } catch (e) {
      console.error("Doom Init Error:", e);
    }
  }

  update() {
    // No-op for logic, handled by DOSBox
  }

  // Get the current frame as a low-res pixel array for the dots
  getFrame(cols, rows) {
    if (!this.isRunning) return null;

    // Draw the WebGL canvas content to our 2D context?
    // js-dos canvas might be WebGL. 
    // If this.canvas is the one passed to Dos(), it gets the content.

    // Optimization: Don't read full 320x200 if we just map to ~50x25
    // But we can't easily read partial with interpolation. 
    // Just read all or drawImage to a smaller canvas.

    // Use a temp generic canvas for resizing?
    // Let's assume this.canvas has the image.

    // Problem: gl.readPixels is upside down? 
    // Let's try drawing this.canvas to an offscreen small canvas.

    if (!this.smallCanvas) {
      this.smallCanvas = document.createElement('canvas');
    }
    if (this.smallCanvas.width !== cols || this.smallCanvas.height !== rows) {
      this.smallCanvas.width = cols;
      this.smallCanvas.height = rows;
      this.smallCtx = this.smallCanvas.getContext('2d');
    }

    // Draw DOSBox canvas to Small Canvas (Downscale)
    this.smallCtx.drawImage(this.canvas, 0, 0, cols, rows);

    // Read pixels
    return this.smallCtx.getImageData(0, 0, cols, rows).data;
  }

  handleKeyDown(code) {
    if (!this.ci) return;
    if (this.pressedKeys.has(code)) return;

    const dosCode = this.keyMap[code];
    if (dosCode) {
      this.pressedKeys.add(code);
      this.keyPressTimes.set(code, Date.now());
      this.ci.simulateKeyEvent(dosCode, true);
    }
  }

  handleKeyUp(code) {
    if (!this.ci) return;

    // Immediate release (Clean Debounce)
    this.forceRelease(code);
  }

  forceRelease(code) {
    if (this.pressedKeys.has(code)) {
      this.pressedKeys.delete(code);
      this.keyPressTimes.delete(code);
      const dosCode = this.keyMap[code];
      if (dosCode) {
        this.ci.simulateKeyEvent(dosCode, false);
      }
    }
  }

  stop() {
    if (this.ci) {
      try {
        this.ci.exit();
        console.log("Doom Stopped");
      } catch (e) {
        console.error("Error stopping Doom:", e);
      }
      this.ci = null;
    }
    this.isRunning = false;
    this.pressedKeys.clear();
    this.keyPressTimes.clear();
  }
}

// Global instance
window.doomAdapter = new DoomAdapter();
