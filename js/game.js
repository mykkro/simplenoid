/**
 * Raphanoid — Arkanoid clone
 *
 * Originally built with Raphael.js (SVG) and jQuery.
 * Rewritten in ES6 + HTML5 Canvas — no external dependencies.
 *
 * Architecture overview:
 *   Config    – brick-type catalogue and level definitions (data only)
 *   Brick     – a single brick: position, HP, drawing, hit/destroy logic
 *   Ball      – the ball: position, velocity, drawing, per-frame movement
 *   Bat       – the player paddle: position, drawing, clamped movement
 *   Button    – a canvas-drawn clickable button (used for Start / Well Done / Game Over)
 *   Game      – top-level orchestrator: game loop, collision detection, state machine
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Width and height of the playfield in pixels. */
const CANVAS_W = 400;
const CANVAS_H = 400;

/** Each brick is placed on a grid where one cell = CELL × CELL pixels. */
const CELL = 20;

/** Game-loop tick interval in milliseconds (~33 fps). */
const TICK_MS = 30;

// ─────────────────────────────────────────────────────────────────────────────
//  Config — brick types and level layouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Brick type catalogue.
 *
 * Each entry describes the visual and gameplay properties of one brick kind:
 *   width / height  – dimensions in grid cells
 *   points          – score awarded on every hit
 *   lives           – hits required to destroy (ignored when unbreakable)
 *   color           – CSS colour string
 *   unbreakable     – if true the brick can never be destroyed
 *   morphsTo        – if set, a new brick of this type spawns when this one is
 *                     destroyed (used for the two-stage "double" brick)
 */
const BRICK_TYPES = {
  basic: {
    width: 2, height: 1,
    points: 10, lives: 1,
    color: '#26c6da',
  },
  double: {
    width: 2, height: 1,
    points: 10, lives: 1,
    color: '#5c6bc0',
    morphsTo: 'basic',   // becomes a basic brick when destroyed
  },
  solid: {
    width: 2, height: 1,
    points: 10, lives: 2, // requires two hits
    color: '#ef5350',
  },
  unbreakable: {
    width: 2, height: 1,
    points: 10, lives: 1,
    color: '#fdd835',
    unbreakable: true,   // cannot be removed
  },
};

/**
 * Level layouts.
 * Each brick is specified as { type, x, y } in grid coordinates.
 * The coordinate origin is the top-left corner of the canvas.
 */
const LEVELS = [
  {
    name: 'Super Simple',
    bricks: [
      { x: 3,  y: 3, type: 'basic' },
      { x: 5,  y: 3, type: 'solid' },
      { x: 7,  y: 3, type: 'basic' },
      { x: 9,  y: 3, type: 'solid' },
      { x: 11, y: 3, type: 'basic' },
      { x: 13, y: 3, type: 'solid' },
      { x: 15, y: 3, type: 'basic' },
    ],
  },
  {
    name: 'Demo Level',
    bricks: [
      { x: 1,  y: 1, type: 'basic'  }, { x: 3,  y: 1, type: 'double' },
      { x: 5,  y: 1, type: 'basic'  }, { x: 7,  y: 1, type: 'double' },
      { x: 9,  y: 1, type: 'basic'  }, { x: 11, y: 1, type: 'double' },
      { x: 13, y: 1, type: 'basic'  }, { x: 15, y: 1, type: 'double' },
      { x: 17, y: 1, type: 'basic'  },
      { x: 2,  y: 2, type: 'basic'  }, { x: 4,  y: 2, type: 'basic'  },
      { x: 6,  y: 2, type: 'basic'  }, { x: 8,  y: 2, type: 'basic'  },
      { x: 10, y: 2, type: 'basic'  }, { x: 12, y: 2, type: 'basic'  },
      { x: 14, y: 2, type: 'basic'  }, { x: 16, y: 2, type: 'basic'  },
      { x: 3,  y: 3, type: 'basic'  }, { x: 5,  y: 3, type: 'basic'  },
      { x: 7,  y: 3, type: 'basic'  }, { x: 9,  y: 3, type: 'solid'  },
      { x: 11, y: 3, type: 'basic'  }, { x: 13, y: 3, type: 'basic'  },
      { x: 15, y: 3, type: 'basic'  },
    ],
  },
  {
    name: 'Demo Level 2',
    bricks: [
      { x: 1,  y: 1, type: 'basic'       }, { x: 3,  y: 1, type: 'double'      },
      { x: 5,  y: 1, type: 'basic'       }, { x: 7,  y: 1, type: 'double'      },
      { x: 9,  y: 1, type: 'basic'       }, { x: 11, y: 1, type: 'double'      },
      { x: 13, y: 1, type: 'basic'       }, { x: 15, y: 1, type: 'double'      },
      { x: 17, y: 1, type: 'basic'       },
      { x: 2,  y: 2, type: 'basic'       }, { x: 4,  y: 2, type: 'basic'       },
      { x: 6,  y: 2, type: 'basic'       }, { x: 8,  y: 2, type: 'basic'       },
      { x: 10, y: 2, type: 'basic'       }, { x: 12, y: 2, type: 'basic'       },
      { x: 14, y: 2, type: 'basic'       }, { x: 16, y: 2, type: 'basic'       },
      { x: 3,  y: 3, type: 'basic'       }, { x: 5,  y: 3, type: 'unbreakable' },
      { x: 7,  y: 3, type: 'basic'       }, { x: 9,  y: 3, type: 'solid'       },
      { x: 11, y: 3, type: 'basic'       }, { x: 13, y: 3, type: 'unbreakable' },
      { x: 15, y: 3, type: 'basic'       },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Return the unit vector of (x, y). */
function normalizeVector(x, y) {
  const len = Math.sqrt(x * x + y * y);
  return { x: x / len, y: y / len };
}

/**
 * Stroke/fill a rounded rectangle on a 2D canvas context.
 * The path is left open so the caller can choose fill, stroke, or both.
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Brick
// ─────────────────────────────────────────────────────────────────────────────

/** Auto-incrementing counter for unique brick IDs. */
let _brickIdCounter = 0;

class Brick {
  /**
   * @param {string} type  Key in BRICK_TYPES
   * @param {number} x     Grid column (left edge)
   * @param {number} y     Grid row    (top edge)
   */
  constructor(type, x, y) {
    this.id    = `brick${_brickIdCounter++}`;
    this.x     = x;
    this.y     = y;
    this.def   = BRICK_TYPES[type];
    this.lives = this.def.lives;

    // Event callbacks — wired up by Game._putBrick()
    this.onHit     = () => {};
    this.onDestroy = () => {};
    this.onRespawn = () => {};
  }

  /**
   * Return the axis-aligned bounding box in pixels, optionally expanded by
   * `border` on every side (used to give the ball some collision margin).
   */
  extents(border = 0) {
    return {
      xMin: this.x * CELL - border,
      yMin: this.y * CELL - border,
      xMax: this.x * CELL + this.def.width  * CELL + border,
      yMax: this.y * CELL + this.def.height * CELL + border,
    };
  }

  /**
   * Return true if pixel position (x, y) falls inside this brick's bounding
   * box expanded by `radius`.  Used to detect when the ball centre is already
   * overlapping a brick.
   */
  testBall(x, y, radius) {
    const { xMin, xMax, yMin, yMax } = this.extents(radius);
    return x >= xMin && x <= xMax && y >= yMin && y <= yMax;
  }

  /** Called when the ball makes contact with this brick. */
  hit() {
    this.onHit(this);

    // Play a short bounce sound; ignore autoplay-policy errors silently
    const snd = new Audio('media/boing2.wav');
    snd.volume = 0.1;
    snd.play().catch(() => {});

    if (!this.def.unbreakable) {
      this.lives--;
      if (this.lives === 0) this.destroy();
    }
  }

  /** Remove the brick; optionally morph it into another type first. */
  destroy() {
    if (this.def.morphsTo) {
      // Signal the game to place a replacement brick at the same position
      this.onRespawn(this.def.morphsTo, this.x, this.y);
    }
    this.onDestroy(this);
  }

  /** Draw this brick onto the canvas context. */
  draw(ctx) {
    const { xMin, yMin } = this.extents(0);
    const w = this.def.width  * CELL;
    const h = this.def.height * CELL;

    // Solid bricks change shade on the first hit to indicate damage
    const isDamaged = this.def.lives === 2 && this.lives === 1;
    ctx.fillStyle = isDamaged ? '#ff8a80' : this.def.color;

    roundRect(ctx, xMin + 1, yMin + 1, w - 2, h - 2, 3);
    ctx.fill();

    // Subtle dark border
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top-edge highlight for a slight 3-D look
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xMin + 4, yMin + 2);
    ctx.lineTo(xMin + w - 4, yMin + 2);
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ball
// ─────────────────────────────────────────────────────────────────────────────

class Ball {
  constructor() {
    this.radius = 8;
    this.reset();
  }

  /** Return the ball to its starting position and direction. */
  reset() {
    this.x     = CANVAS_W / 2;
    this.y     = 240;
    this.dx    = 0;   // unit-vector x component
    this.dy    = 1;   // unit-vector y component (pointing down)
    this.speed = 6;   // pixels per frame
  }

  /**
   * Advance the ball by one frame.
   *
   * Flow:
   *   1. If the ball centre is already inside a brick, register a hit and
   *      bounce off that brick.
   *   2. If the ball has reached the bottom boundary, signal a life loss.
   *   3. Otherwise test reflections against walls and bat, take the earliest.
   *   4. Clamp the vertical component to prevent infinite horizontal looping.
   *   5. Re-normalise to unit vector.
   *
   * @param {Game} game  The parent game, used for collision helpers and callbacks.
   */
  move(game) {
    const brick = game.findBrickAtPosition(this.x, this.y);

    let bb;
    if (brick) {
      // Ball is overlapping a brick — bounce off it
      brick.hit();
      bb = game.testCollisionsWithBrick(
        this.x, this.y, this.dx, this.dy, this.speed, brick
      );
    } else if (this.y + this.dy * this.speed > CANVAS_H - this.radius) {
      // Ball escaped through the bottom — lose a life and abort this frame
      game.loseLife();
      return;
    } else {
      // Test walls and bat; prefer whichever collision happens first
      // (more remaining distance = earlier collision)
      const cWall = game.testCollisionsWithWalls(
        this.x, this.y, this.dx, this.dy, this.speed
      );
      const cBat = game.testCollisionsWithBat(
        this.x, this.y, this.dx, this.dy, this.speed
      );
      bb = cBat.distance > cWall.distance ? cBat : cWall;
    }

    // Prevent the ball from getting stuck in near-horizontal oscillation
    if (Math.abs(bb.dy) < 0.15) {
      bb.dy = bb.dy < 0 ? -0.15 : 0.15;
    }

    // Keep direction as a unit vector
    const norm = normalizeVector(bb.dx, bb.dy);
    this.x  = bb.x;
    this.y  = bb.y;
    this.dx = norm.x;
    this.dy = norm.y;
  }

  /** Draw the ball with a subtle specular highlight. */
  draw(ctx) {
    // Main body
    ctx.fillStyle = '#37474f';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight (small bright circle offset toward top-left)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(
      this.x - this.radius * 0.3,
      this.y - this.radius * 0.3,
      this.radius * 0.35,
      0, Math.PI * 2
    );
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bat (paddle)
// ─────────────────────────────────────────────────────────────────────────────

class Bat {
  constructor() {
    this.width  = 60;
    this.height = 20;
    /** Left/right boundary for the bat centre (keeps it inside the canvas). */
    this.minX   = 40;
    this.maxX   = CANVAS_W - 40;
    this.speed  = 6;
    this.reset();
  }

  /** Return the bat to its starting position. */
  reset() {
    this.x = CANVAS_W / 2;
    this.y = 370;
  }

  /**
   * Move the bat horizontally.
   * @param {number} dir  –1 for left, +1 for right
   */
  move(dir) {
    this.x = Math.max(this.minX, Math.min(this.maxX, this.x + this.speed * dir));
  }

  /** Draw the paddle with a simple top-to-bottom gradient sheen. */
  draw(ctx) {
    const x = this.x - this.width  / 2;
    const y = this.y - this.height / 2;

    // Body
    ctx.fillStyle = '#546e7a';
    roundRect(ctx, x, y, this.width, this.height, 8);
    ctx.fill();

    // Gloss overlay
    const grad = ctx.createLinearGradient(x, y, x, y + this.height);
    grad.addColorStop(0,   'rgba(255,255,255,0.28)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, this.width, this.height, 8);
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Button (canvas overlay)
// ─────────────────────────────────────────────────────────────────────────────

class Button {
  /**
   * @param {string}   label    Text shown on the button
   * @param {string}   color    Background colour
   * @param {Function} onClick  Called when the user clicks the button
   */
  constructor(label, color, onClick) {
    this.label   = label;
    this.color   = color;
    this.onClick = onClick;
    // Centred in the canvas
    this.x = 150;
    this.y = 180;
    this.w = 100;
    this.h = 40;
  }

  /** Return true if canvas-space point (px, py) is inside this button. */
  contains(px, py) {
    return px >= this.x && px <= this.x + this.w &&
           py >= this.y && py <= this.y + this.h;
  }

  draw(ctx) {
    // Drop shadow
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = this.color;
    roundRect(ctx, this.x, this.y, this.w, this.h, 10);
    ctx.fill();
    ctx.restore();

    // Label
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 14px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, this.x + this.w / 2, this.y + this.h / 2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Game
// ─────────────────────────────────────────────────────────────────────────────

class Game {
  /**
   * @param {HTMLCanvasElement} canvas  The target canvas element
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // Game state
    this.level   = 0;
    this.score   = 0;
    this.lives   = 3;
    this.running = false;

    /** Active bricks, keyed by brick.id. */
    this.bricks = {};

    /** Currently displayed overlay button (Start / Well Done / Game Over), or null. */
    this.button = null;

    // Core entities
    this.ball = new Ball();
    this.bat  = new Bat();

    // Keyboard state — true while the key is held down
    this._keys = { left: false, right: false };
    document.addEventListener('keydown', e => this._onKeyDown(e));
    document.addEventListener('keyup',   e => this._onKeyUp(e));

    // Canvas pointer events — route clicks to the active button
    canvas.addEventListener('click',     e => this._onClick(e));
    canvas.addEventListener('mousemove', e => this._onMouseMove(e));

    // Start the first level
    this.init(false);
  }

  // ── Level management ───────────────────────────────────────────────────────

  /**
   * (Re)initialise the current level.
   * @param {boolean} keepScore  If true, score and lives carry over from the
   *                             previous level (used between level transitions).
   */
  init(keepScore) {
    this.running = false;

    if (!keepScore) {
      this.score = 0;
      this.lives = 3;
    }

    this._clearAllBricks();

    for (const { type, x, y } of LEVELS[this.level].bricks) {
      this._putBrick(type, x, y);
    }

    this.ball.reset();
    this.bat.reset();

    this.button = new Button('Start!', '#ff9800', () => this.startGame());
    this.render();
  }

  /**
   * Add a brick to the playfield and wire up its event callbacks.
   * @param {string} type  Key in BRICK_TYPES
   * @param {number} x     Grid column
   * @param {number} y     Grid row
   */
  _putBrick(type, x, y) {
    const brick = new Brick(type, x, y);
    this.bricks[brick.id] = brick;

    brick.onHit     = (b)          => { this.score += b.def.points; };
    brick.onDestroy = (b)          => { this._removeBrick(b); };
    brick.onRespawn = (t, bx, by)  => { this._putBrick(t, bx, by); };
  }

  /**
   * Remove a brick from the game after it is destroyed.
   * Triggers a level-clear check.
   */
  _removeBrick(brick) {
    delete this.bricks[brick.id];

    if (this._isScreenClear()) {
      this.endGame();
      this.button = new Button('Well done!', '#00bcd4', () => {
        this.level = (this.level + 1) % LEVELS.length;
        this.init(true);
      });
    }
  }

  /**
   * Return true when every remaining brick is unbreakable
   * (i.e. all destroyable bricks have been cleared).
   */
  _isScreenClear() {
    return Object.values(this.bricks).every(b => b.def.unbreakable);
  }

  /** Remove all brick instances without animating. */
  _clearAllBricks() {
    this.bricks = {};
  }

  // ── State transitions ──────────────────────────────────────────────────────

  /** Begin (or resume) the game loop. */
  startGame() {
    this.button  = null;
    this.running = true;
    this._scheduleTick();
  }

  /** Halt the game loop (called on level clear and game over). */
  endGame() {
    this.running = false;
  }

  /**
   * Ball fell off the bottom — decrement lives, reset positions, and either
   * continue playing or trigger game over.
   */
  loseLife() {
    this.lives--;
    this.ball.reset();
    this.bat.reset();

    if (this.lives <= 0) {
      this.gameOver();
    }
    // If lives remain, the game loop continues automatically
  }

  /** Lives exhausted — stop the game and show the Game Over button. */
  gameOver() {
    this.endGame();
    this.button = new Button('Game over!', '#78909c', () => {
      this.level = 0;
      this.init(false);
    });
    this.render();
  }

  // ── Game loop ──────────────────────────────────────────────────────────────

  /** Schedule the next tick via setTimeout (preserves fixed-timestep physics). */
  _scheduleTick() {
    if (!this.running) return;
    setTimeout(() => this._tick(), TICK_MS);
  }

  /** One game-loop iteration: physics → input → render → schedule next. */
  _tick() {
    if (!this.running) return;

    this.ball.move(this);

    if (this._keys.left)  this.bat.move(-1);
    if (this._keys.right) this.bat.move(1);

    this.render();
    this._scheduleTick();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  /** Redraw the entire canvas. */
  render() {
    const { ctx } = this;

    // Background
    ctx.fillStyle = '#eceff1';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Bricks
    for (const brick of Object.values(this.bricks)) {
      brick.draw(ctx);
    }

    // Paddle and ball
    this.bat.draw(ctx);
    this.ball.draw(ctx);

    // Heads-up display (score / lives / level name)
    this._drawHUD();

    // Overlay button, if any
    if (this.button) {
      this.button.draw(ctx);
    }
  }

  /** Draw the score, life count, and current level name at the top of the canvas. */
  _drawHUD() {
    const { ctx } = this;

    // Semi-transparent strip so text is readable over bricks
    ctx.fillStyle = 'rgba(236,239,241,0.85)';
    ctx.fillRect(0, 0, CANVAS_W, 20);

    ctx.fillStyle    = '#37474f';
    ctx.font         = 'bold 13px sans-serif';
    ctx.textBaseline = 'middle';

    // Level name — left-aligned
    ctx.textAlign = 'left';
    ctx.fillText(LEVELS[this.level].name, 8, 10);

    // Score — centred
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.score}`, CANVAS_W / 2, 10);

    // Lives — right-aligned
    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${this.lives}`, CANVAS_W - 8, 10);
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  _onKeyDown(e) {
    if (e.key === 'ArrowLeft')  this._keys.left  = true;
    if (e.key === 'ArrowRight') this._keys.right = true;

    // Prevent the page from scrolling while the player uses arrow keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    if (e.key === 'ArrowLeft')  this._keys.left  = false;
    if (e.key === 'ArrowRight') this._keys.right = false;
  }

  /** Forward a canvas click to the active overlay button (if any). */
  _onClick(e) {
    if (!this.button) return;
    const { x, y } = this._canvasPoint(e);
    if (this.button.contains(x, y)) {
      const cb = this.button.onClick;
      this.button = null;
      cb();
    }
  }

  /** Change the cursor to a pointer when hovering over a button. */
  _onMouseMove(e) {
    if (!this.button) {
      this.canvas.style.cursor = 'default';
      return;
    }
    const { x, y } = this._canvasPoint(e);
    this.canvas.style.cursor = this.button.contains(x, y) ? 'pointer' : 'default';
  }

  /**
   * Convert a MouseEvent's client coordinates to canvas-space coordinates,
   * accounting for any CSS scaling of the canvas element.
   */
  _canvasPoint(e) {
    const rect  = this.canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  // ── Collision detection ────────────────────────────────────────────────────

  /**
   * Find the first brick whose extended bounding box contains (x, y).
   * Returns the brick, or null if no brick is found.
   */
  findBrickAtPosition(x, y) {
    for (const br of Object.values(this.bricks)) {
      if (br.testBall(x, y, this.ball.radius)) return br;
    }
    return null;
  }

  /**
   * Ray–AABB collision test: detect whether the ball travelling from (x, y)
   * in direction (dx, dy) for `distance` pixels will hit `brick`.
   *
   * Each face of the brick's bounding box (expanded by the ball radius) is
   * tested in priority order: left → right → top → bottom.
   * The first valid intersection flips the corresponding velocity component.
   *
   * Returns the updated ball state { x, y, dx, dy, distance }.
   */
  testCollisionsWithBrick(x, y, dx, dy, distance, brick) {
    const uu = dx * distance;  // full displacement vector x
    const vv = dy * distance;  // full displacement vector y
    const { xMin, yMin, xMax, yMax } = brick.extents(this.ball.radius);

    let t = 1;           // parametric position along the displacement (0–1)
    let collision = false;

    // ── Horizontal faces ──
    if (uu !== 0) {
      if (!collision && x + uu > xMin) {
        // Approaching the left face
        const tc = (xMin - x) / uu;
        if (tc >= 0 && tc <= 1 && y + vv * tc >= yMin && y + vv * tc <= yMax) {
          dx = -dx;  t = tc;  collision = true;
        }
      }
      if (!collision && x + uu < xMax) {
        // Approaching the right face
        const tc = (x - xMax) / uu;
        if (tc >= 0 && tc <= 1 && y + vv * tc >= yMin && y + vv * tc <= yMax) {
          dx = -dx;  t = tc;  collision = true;
        }
      }
    }

    // ── Vertical faces ──
    if (vv !== 0) {
      if (!collision && y + vv > yMin) {
        // Approaching the top face
        const tc = (yMin - y) / vv;
        if (tc >= 0 && tc <= 1 && x + uu * tc >= xMin && x + uu * tc <= xMax) {
          dy = -dy;  t = tc;  collision = true;
        }
      }
      if (!collision && y + vv < yMax) {
        // Approaching the bottom face
        const tc = (y - yMax) / vv;
        if (tc >= 0 && tc <= 1 && x + uu * tc >= xMin && x + uu * tc <= xMax) {
          dy = -dy;  t = tc;  collision = true;
        }
      }
    }

    if (!collision) t = 1;

    return {
      x: x + uu * t,
      y: y + vv * t,
      dx, dy,
      distance: distance * (1 - t),
    };
  }

  /**
   * Ray–AABB collision test against the bat.
   *
   * Identical to testCollisionsWithBrick for side/bottom faces.
   * On a top-face hit, a "spin" effect is applied based on where the ball
   * lands relative to the bat's centre:
   *   – hitting the edges curves the ball sharply outward
   *   – hitting the centre bounces the ball more vertically
   *
   * Returns the updated ball state { x, y, dx, dy, distance }.
   */
  testCollisionsWithBat(x, y, dx, dy, distance) {
    const uu = dx * distance;
    const vv = dy * distance;
    const br = this.ball.radius;

    const xMin = this.bat.x - this.bat.width  / 2 - br;
    const yMin = this.bat.y - this.bat.height / 2 - br;
    const xMax = this.bat.x + this.bat.width  / 2 + br;
    const yMax = this.bat.y + this.bat.height / 2 + br;

    let t = 1;
    let collision = false;

    if (uu !== 0) {
      if (!collision && x + uu > xMin) {
        const tc = (xMin - x) / uu;
        if (tc >= 0 && tc <= 1 && y + vv * tc >= yMin && y + vv * tc <= yMax) {
          dx = -dx;  t = tc;  collision = true;
        }
      }
      if (!collision && x + uu < xMax) {
        const tc = (x - xMax) / uu;
        if (tc >= 0 && tc <= 1 && y + vv * tc >= yMin && y + vv * tc <= yMax) {
          dx = -dx;  t = tc;  collision = true;
        }
      }
    }

    if (vv !== 0) {
      if (!collision && y + vv > yMin) {
        // Top face — apply spin
        const tc = (yMin - y) / vv;
        const xx = x + uu * tc;
        if (tc >= 0 && tc <= 1 && xx >= xMin && xx <= xMax) {
          // pos ∈ [−1, 1]: left edge = −1, centre = 0, right edge = +1
          const pos = 2 * (xx - xMin) / (xMax - xMin) - 1;

          // Build a reflection normal that tilts outward at the edges
          let flipX = pos * 0.7;
          let flipY = -1;
          const size = Math.sqrt(flipX * flipX + flipY * flipY);
          flipX /= size;
          flipY /= size;

          // Flip dx/dy around the normal via specular reflection formula:
          //   v' = v − 2(v·n)n
          dx = -dx;
          dy = -dy;
          const dot = dx * flipX + dy * flipY;
          dx = dx - 2 * (dx - dot * flipX);
          dy = dy - 2 * (dy - dot * flipY);

          t = tc;  collision = true;
        }
      }
      if (!collision && y + vv < yMax) {
        // Bottom face (ball somehow got under the bat)
        const tc = (y - yMax) / vv;
        if (tc >= 0 && tc <= 1 && x + uu * tc >= xMin && x + uu * tc <= xMax) {
          dy = -dy;  t = tc;  collision = true;
        }
      }
    }

    if (!collision) t = 1;

    return {
      x: x + uu * t,
      y: y + vv * t,
      dx, dy,
      distance: distance * (1 - t),
    };
  }

  /**
   * Reflect the ball off the three solid walls (left, right, top).
   * The bottom is intentionally open — escaping through it loses a life.
   *
   * Uses a parametric approach: find the earliest wall crossing along the
   * displacement vector, flip the appropriate velocity component there.
   *
   * Returns the updated ball state { x, y, dx, dy, distance }.
   */
  testCollisionsWithWalls(x, y, dx, dy, distance) {
    const uu = dx * distance;
    const vv = dy * distance;
    const br = this.ball.radius;

    const xMin = br;
    const xMax = CANVAS_W - br;
    const yMin = br;
    // No yMax — the bottom is open

    let tx = Infinity;  // parametric t for the earliest x-axis wall hit
    let ty = Infinity;  // parametric t for the earliest y-axis wall hit

    if (uu < 0 && x + uu < xMin) tx = (xMin - x) / uu;   // left wall
    if (uu > 0 && x + uu > xMax) tx = (xMax - x) / uu;   // right wall
    if (vv < 0 && y + vv < yMin) ty = (yMin - y) / vv;   // top wall

    // Take the closer collision (smallest t); fall back to t=1 (no collision)
    let t      = 1;
    let flipDx = false;
    let flipDy = false;

    if (tx < 1 || ty < 1) {
      if (tx <= ty) { t = tx;  flipDx = true; }
      else          { t = ty;  flipDy = true; }
    }

    if (flipDx) dx = -dx;
    if (flipDy) dy = -dy;

    return {
      x: x + uu * t,
      y: y + vv * t,
      dx, dy,
      distance: distance * (1 - t),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  // eslint-disable-next-line no-new
  new Game(canvas);
});
