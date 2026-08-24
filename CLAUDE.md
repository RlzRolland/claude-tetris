# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris implemented in vanilla JavaScript with HTML5 Canvas and CSS — no dependencies, no build step, no package.json.

## Running the game

There is no build/lint/test tooling. To run and manually verify changes:

```bash
open index.html            # macOS, opens directly in default browser
python3 -m http.server 8000  # or serve locally, then open http://localhost:8000
```

Verify changes by playing the game in the browser (move/rotate/soft drop/hard drop/pause, trigger a line clear, trigger game over/restart).

## Architecture

Three files, no modules/bundler — `game.js` is loaded as a single classic script and relies on global scope.

- `index.html` — DOM structure: main `#board` canvas (300×600, i.e. `COLS*BLOCK` × `ROWS*BLOCK`), a `#next-canvas` preview canvas, HUD elements (`#score`, `#lines`, `#level`), and a shared `#overlay` used for both PAUSE and GAME OVER states.
- `style.css` — dark/retro arcade visual theme only; no layout logic depends on it.
- `game.js` — all game logic, organized around:
  - **Board model**: `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–7` identifying the locked piece type.
  - **Pieces**: the 7 tetrominoes as square matrices in `PIECES`; rotation is done via `rotateCW` (transpose + row reverse), applied through `tryRotate`, which attempts wall-kick offsets `[0, -1, 1, -2, 2]` before giving up on a rotation.
  - **Collision** (`collide`): checks board bounds and overlap with locked cells; used for movement, rotation, and ghost-piece projection.
  - **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece once `dropAccum >= dropInterval`.
  - **Line clearing** (`clearLines`): scans bottom-to-top, splices full rows out and unshifts empty rows at the top; updates score/lines/level and recalculates `dropInterval`.
  - **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by current `level`; hard drop adds 2 points per cell dropped, soft drop adds 1 point per row.
  - **Level/speed**: level increases every 10 cleared lines; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
  - **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.
  - All game state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, timing vars) lives in module-level `let` bindings reset by `init()`; there is no state container/class.

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS*BLOCK` × `ROWS*BLOCK`).
