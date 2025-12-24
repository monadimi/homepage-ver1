class TetrisGame {
  constructor() {
    this.cols = 10;
    this.rows = 20;
    this.board = []; // 2D array [y][x]
    this.score = 0;
    this.gameOver = false;
    this.isRunning = false;

    this.currentPiece = null;
    this.pieceX = 0;
    this.pieceY = 0;

    // Tetromino definitions
    this.SHAPES = [
      [[1, 1, 1, 1]], // I
      [[1, 1], [1, 1]], // O
      [[0, 1, 0], [1, 1, 1]], // T
      [[1, 0, 0], [1, 1, 1]], // L
      [[0, 0, 1], [1, 1, 1]], // J
      [[0, 1, 1], [1, 1, 0]], // S
      [[1, 1, 0], [0, 1, 1]]  // Z
    ];

    this.COLORS = [
      null,
      '#00f0f0', // I - Cyan
      '#f0f000', // O - Yellow
      '#a000f0', // T - Purple
      '#f0a000', // L - Orange
      '#0000f0', // J - Blue
      '#00f000', // S - Green
      '#f00000'  // Z - Red
    ];

    this.init();
  }

  init() {
    // Empty board
    this.board = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    this.score = 0;
    this.level = 0;
    this.lines = 0;
    this.gameOver = false;
    this.spawnPiece();
  }

  start() {
    this.init();
    this.isRunning = true;
  }

  pause() {
    this.isRunning = false;
  }

  resume() {
    if (!this.gameOver) this.isRunning = true;
  }

  spawnPiece() {
    const typeId = Math.floor(Math.random() * this.SHAPES.length);
    this.currentPiece = this.SHAPES[typeId];
    this.currentColor = this.COLORS[typeId + 1]; // +1 because 0 is empty
    this.pieceX = Math.floor(this.cols / 2) - Math.floor(this.currentPiece[0].length / 2);
    this.pieceY = 0;

    // Check collision on spawn
    if (this.checkCollision(this.pieceX, this.pieceY, this.currentPiece)) {
      this.gameOver = true;
      this.isRunning = false;
    }
  }

  rotate(matrix) {
    const N = matrix.length;
    const M = matrix[0].length;
    const result = Array.from({ length: M }, () => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < M; x++) {
        result[x][N - 1 - y] = matrix[y][x];
      }
    }
    return result;
  }

  move(dx, dy) {
    if (!this.isRunning || this.gameOver) return;

    if (!this.checkCollision(this.pieceX + dx, this.pieceY + dy, this.currentPiece)) {
      this.pieceX += dx;
      this.pieceY += dy;
      return true; // Moved successfully
    } else if (dy > 0) {
      // Hit bottom or other piece
      this.lockPiece();
      this.clearLines();
      this.spawnPiece();
      return false; // Hit something
    }
    return false; // Blocked
  }

  rotatePiece() {
    if (!this.isRunning || this.gameOver) return;
    const rotated = this.rotate(this.currentPiece);
    if (!this.checkCollision(this.pieceX, this.pieceY, rotated)) {
      this.currentPiece = rotated;
    } else {
      // Wall kick attempt (simple)
      if (!this.checkCollision(this.pieceX - 1, this.pieceY, rotated)) {
        this.pieceX -= 1;
        this.currentPiece = rotated;
      } else if (!this.checkCollision(this.pieceX + 1, this.pieceY, rotated)) {
        this.pieceX += 1;
        this.currentPiece = rotated;
      }
    }
  }

  drop() {
    this.move(0, 1);
    // Auto drop gives no score usually
  }

  softDrop() {
    if (this.move(0, 1)) {
      this.score += 1; // 1 point per cell
    }
  }

  hardDrop() {
    if (!this.isRunning || this.gameOver) return;
    let dropped = 0;
    while (this.move(0, 1)) {
      dropped++;
    }
    this.score += dropped * 2;
  }

  // CCW Rotation: Transpose -> Reverse Cols? 
  // Standard CW: (x,y) -> (y, x) -> reverse rows
  // CCW: (x,y) -> (y, x) -> reverse cols?
  // Let's use formula: dest[y][x] = src[x][N-1-y]
  rotateCCW(matrix) {
    const N = matrix.length;
    const M = matrix[0].length;
    const result = Array.from({ length: M }, () => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < M; x++) {
        result[N - 1 - x][y] = matrix[y][x];
      }
    }
    return result;
  }

  rotatePieceCCW() {
    if (!this.isRunning || this.gameOver) return;
    const rotated = this.rotateCCW(this.currentPiece);
    if (!this.checkCollision(this.pieceX, this.pieceY, rotated)) {
      this.currentPiece = rotated;
    } else {
      // Wall kick attempt (simple)
      if (!this.checkCollision(this.pieceX - 1, this.pieceY, rotated)) {
        this.pieceX -= 1;
        this.currentPiece = rotated;
      } else if (!this.checkCollision(this.pieceX + 1, this.pieceY, rotated)) {
        this.pieceX += 1;
        this.currentPiece = rotated;
      }
    }
  }

  checkCollision(x, y, piece) {
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (piece[r][c]) {
          const newX = x + c;
          const newY = y + r;
          if (newX < 0 || newX >= this.cols || newY >= this.rows) return true;
          if (newY >= 0 && this.board[newY][newX]) return true;
        }
      }
    }
    return false;
  }

  lockPiece() {
    for (let r = 0; r < this.currentPiece.length; r++) {
      for (let c = 0; c < this.currentPiece[r].length; c++) {
        if (this.currentPiece[r][c]) {
          const py = this.pieceY + r;
          if (py >= 0) {
            this.board[py][this.pieceX + c] = this.currentColor;
          }
        }
      }
    }
  }

  clearLines() {
    let linesCleared = 0;
    for (let y = this.rows - 1; y >= 0; y--) {
      if (this.board[y].every(cell => cell !== 0)) {
        this.board.splice(y, 1);
        this.board.unshift(Array(this.cols).fill(0));
        linesCleared++;
        y++; // Recheck same row
      }
    }

    if (linesCleared > 0) {
      // NES Scoring: Base * (Level + 1)
      const baseScores = [0, 100, 300, 500, 800];
      this.score += baseScores[linesCleared] * (this.level + 1);

      this.lines += linesCleared;

      // Level up every 10 lines
      this.level = Math.floor(this.lines / 10);
    }
  }

  // Font Data (3x5)
  getDigitPattern(char) {
    const patterns = {
      '0': [[1, 1, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 1, 1]],
      '1': [[0, 1, 0], [1, 1, 0], [0, 1, 0], [0, 1, 0], [1, 1, 1]],
      '2': [[1, 1, 1], [0, 0, 1], [1, 1, 1], [1, 0, 0], [1, 1, 1]],
      '3': [[1, 1, 1], [0, 0, 1], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
      '4': [[1, 0, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1], [0, 0, 1]],
      '5': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
      '6': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 1], [1, 1, 1]],
      '7': [[1, 1, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]],
      '8': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 1, 1]],
      '9': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
      'S': [[0, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0]],
      'C': [[0, 1, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [0, 1, 1]],
      'O': [[0, 1, 0], [1, 0, 1], [1, 0, 1], [1, 0, 1], [0, 1, 0]],
      'R': [[1, 1, 0], [1, 0, 1], [1, 1, 0], [1, 0, 1], [1, 0, 1]],
      'E': [[1, 1, 1], [1, 0, 0], [1, 1, 0], [1, 0, 0], [1, 1, 1]],
      'L': [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 1, 1]],
      'V': [[1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1], [0, 1, 0]],
      'G': [[0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 0, 1], [0, 1, 1]],
      'A': [[0, 1, 0], [1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 0, 1]],
      'M': [[1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1]]
    };
    return patterns[char] || patterns['0'];
  }

  // Draw Interface for Dots system
  // This function projects the tetris board onto the larger grid
  updateGrid(dots, cols, rows) {
    if (!this.isRunning && !this.gameOver) return;

    // Calculate offsets to center the 10x20 board on the dot grid
    const startCol = Math.floor((cols - this.cols) / 2);
    const startRow = Math.floor((rows - this.rows) / 2);

    // 1. Draw Walls (Border)
    // Frame is from -1 to cols, -1 to rows relative to board
    const wallColor = '#444444'; // Dim gray for walls

    for (let y = -1; y <= this.rows; y++) {
      for (let x = -1; x <= this.cols; x++) {
        // Check if outline
        if (x === -1 || x === this.cols || y === this.rows) {
          const dotCol = startCol + x;
          const dotRow = startRow + y;
          if (dotCol >= 0 && dotCol < cols && dotRow >= 0 && dotRow < rows) {
            const dot = dots[dotRow * cols + dotCol];
            dot.alive = true;
            dot.color = wallColor;
            dot.opacity = 0.5;
          }
        }
      }
    }

    // 2. Render Board Content
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const dotCol = startCol + x;
        const dotRow = startRow + y;

        if (dotCol >= 0 && dotCol < cols && dotRow >= 0 && dotRow < rows) {
          const dot = dots[dotRow * cols + dotCol];

          if (this.board[y][x]) {
            dot.alive = true;
            dot.color = this.board[y][x];
            dot.opacity = 1;
          } else {
            // Empty space
            // Only set if not already set by wall (shouldn't overlap, but safety)
            dot.alive = false;
            dot.color = null;
            dot.opacity = 0.05; // Slight grid hint
          }
        }
      }
    }

    // 3. Render Current Piece
    if (this.currentPiece) {
      for (let r = 0; r < this.currentPiece.length; r++) {
        for (let c = 0; c < this.currentPiece[r].length; c++) {
          if (this.currentPiece[r][c]) {
            const boardX = this.pieceX + c;
            const boardY = this.pieceY + r;

            // Optimization: Don't draw if above board (hidden rows)
            if (boardY < 0) continue;

            const dotCol = startCol + boardX;
            const dotRow = startRow + boardY;

            if (dotCol >= 0 && dotCol < cols && dotRow >= 0 && dotRow < rows) {
              const dot = dots[dotRow * cols + dotCol];
              dot.alive = true;
              dot.color = this.currentColor;
              dot.opacity = 1;
            }
          }
        }
      }
    }

    // 5. Render Game Over Overlay
    if (this.gameOver) {
      // Centered Text
      // "GAME" (4 chars * 4 width = 16)
      // "OVER" (4 chars)
      // Board width is 10. 10 * SPACING?
      // Wait, drawText maps to grid coords, not pixels.
      // Board is 10 wide. "GAME" is 4 chars * 4 spacing = 16 wide. Too wide for board?
      // Board is 10 cols. 
      // 10 cols is narrow. "GAME" needs 15 cols minimum (3 width + 1 space * 4 chars - 1 space).
      // It will overflow the board. That's fine, it can overlay walls.

      const centerX = startCol + Math.floor(this.cols / 2);
      const centerY = startRow + Math.floor(this.rows / 2);

      // "GAME"
      // Width 15, Shift left by 7.
      this.drawText(dots, cols, rows, "GAME", centerX - 7, centerY - 4, '#ff0000');
      // "OVER"
      this.drawText(dots, cols, rows, "OVER", centerX - 7, centerY + 2, '#ff0000');
    }

    // 4. Render Score & Level
    const infoX = startCol + this.cols + 2;
    const infoWidth = 40; // Approx width to clear

    // Clear Score Area First
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < infoWidth; x++) {
        const dotCol = infoX + x;
        const dotRow = startRow + y;
        if (dotCol >= 0 && dotCol < cols && dotRow >= 0 && dotRow < rows) {
          const dot = dots[dotRow * cols + dotCol];
          dot.alive = false;
          dot.color = null;
          dot.opacity = 0.05;
        }
      }
    }

    this.drawText(dots, cols, rows, "SCORE", infoX, startRow);
    this.drawText(dots, cols, rows, this.score.toString(), infoX, startRow + 6);

    this.drawText(dots, cols, rows, "LV", infoX, startRow + 12);
    this.drawText(dots, cols, rows, this.level.toString(), infoX, startRow + 18);
  }

  drawText(dots, cols, rows, text, startX, startY, color = '#ffffff') {
    let currentX = startX;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const pattern = this.getDigitPattern(char);

      for (let py = 0; py < 5; py++) {
        for (let px = 0; px < 3; px++) {
          if (pattern[py][px]) {
            const dotCol = currentX + px;
            const dotRow = startY + py;

            if (dotCol >= 0 && dotCol < cols && dotRow >= 0 && dotRow < rows) {
              const dot = dots[dotRow * cols + dotCol];
              dot.alive = true;
              dot.color = color;
              dot.opacity = 0.8;
            }
          }
        }
      }
      currentX += 4; // 3 width + 1 spacing
    }
  }
}
