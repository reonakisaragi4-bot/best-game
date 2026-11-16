// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// game over and win.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_REPAIR, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Convert a canvas-pixel point to field coordinates, mirroring the renderer. */
function toField(clientX, clientY) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = Math.min(width / FIELD.width, height / FIELD.height);
  const offsetX = (width - FIELD.width * scale) / 2;
  const offsetY = (height - FIELD.height * scale) / 2;
  return [(clientX - offsetX) / scale, (clientY - offsetY) / scale];
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Three hull. Clear ten waves to win.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Sector cleared. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  /** Aim at the mouse when it has moved, else at the nearest enemy. */
  function aimAngle() {
    const ship = world.state.ship;
    const mouse = input.aim();
    if (mouse) {
      const [fieldX, fieldY] = toField(mouse[0], mouse[1]);
      return Math.atan2(fieldY - ship.y, fieldX - ship.x);
    }
    let nearest = null;
    let nearestDist = Infinity;
    for (const enemy of world.state.enemies) {
      const dist = Math.hypot(enemy.x - ship.x, enemy.y - ship.y);
      if (dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }
    return nearest ? Math.atan2(nearest.y - ship.y, nearest.x - ship.x) : null;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & 8) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, [0, 0], false, null, true);
      return;
    }
    const events = world.step(STEP, input.direction(), input.firing(), aimAngle(), false);
    if (events & EVENT_KILL) audio.explosion();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_REPAIR) audio.pickup();
    if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    } else if (events & EVENT_OVER) {
      audio.explosion();
      endGame(false);
    } else if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.hull === 1 ? 'Hit. 1 hull left.' : `Hit. ${world.state.hull} hull left.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting enemies close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumen Drift. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
