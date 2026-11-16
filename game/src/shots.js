// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed time, steered by a simple autopilot, so
// the frame is what a short game really looks like and the same seed always
// gives the same frame. The play pilot dodges, chases cells and fires at the
// nearest enemy; the end pilot does nothing at all, so the drifters and seekers
// catch the ship, as they would a player who never touches the controls.

import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 31;
const END_LIMIT_SECONDS = 300;

/** How far a threat must be before the pilot stops running from it. */
const DANGER_RANGE = 230;
/** How far a cell must be before the pilot bothers chasing it. */
const CELL_RANGE = 420;

function nearest(state, list) {
  const ship = state.ship;
  let found = null;
  let foundDist = Infinity;
  for (const item of list) {
    const dist = Math.hypot(item.x - ship.x, item.y - ship.y);
    if (dist < foundDist) {
      found = item;
      foundDist = dist;
    }
  }
  return { item: found, dist: foundDist };
}

/** The end scene's pilot: it sits still and shoots at whatever comes close, so
 * it scores a few kills before the drifters and seekers catch it. */
function sittingDuck(state) {
  const threat = nearest(state, state.enemies);
  const aim = threat.item ? Math.atan2(threat.item.y - state.ship.y, threat.item.x - state.ship.x) : null;
  return { move: [0, 0], fire: threat.item !== null && threat.dist < 560, aim };
}
function autopilot(state) {
  const ship = state.ship;
  const threat = nearest(state, state.enemies);
  const cell = nearest(state, state.pickups.filter((pickup) => pickup.kind === 'cell'));
  let mx = 0;
  let my = 0;
  if (threat.item && threat.dist < DANGER_RANGE) {
    const dx = ship.x - threat.item.x;
    const dy = ship.y - threat.item.y;
    const dist = Math.hypot(dx, dy) || 1;
    mx = dx / dist;
    my = dy / dist;
  } else if (cell.item && cell.dist < CELL_RANGE) {
    const dx = cell.item.x - ship.x;
    const dy = cell.item.y - ship.y;
    const dist = Math.hypot(dx, dy) || 1;
    mx = dx / dist;
    my = dy / dist;
  } else if (threat.item) {
    const dx = threat.item.x - ship.x;
    const dy = threat.item.y - ship.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 320) {
      mx = dx / dist;
      my = dy / dist;
    }
  }
  const aim = threat.item ? Math.atan2(threat.item.y - ship.y, threat.item.x - ship.x) : null;
  return { move: [mx, my], fire: threat.item !== null && threat.dist < 560, aim };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, [0, 0], false, null, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const steps = Math.floor(limit / STEP);
  for (let index = 0; index < steps; index += 1) {
    const control = name === 'end' ? sittingDuck(world.state) : autopilot(world.state);
    const events = world.step(STEP, control.move, control.fire, control.aim, false);
    if (events & EVENT_OVER) break;
  }
  if (name === 'end') {
    // Let the death flash fade and the explosion settle before the frame is
    // taken, or the whole end screen drowns in red.
    for (let index = 0; index < 60; index += 1) {
      world.step(STEP, [0, 0], false, null, true);
    }
  }
  const over = world.state.hull <= 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
