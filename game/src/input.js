// Keyboard and mouse, read as a direction plus a few one-shot actions. The ship
// moves with WASD or the arrow keys; the mouse aims and holding the button (or
// Space) fires. P or Escape pauses; Space, Enter or a click confirms on menus.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_FIRE = 4;

const MOVE_KEYS = {
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    }
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= 8; // mute toggle, handled by the game
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      actions |= ACTION_CONFIRM;
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return {
    /** Normalised move direction from the held keys, or [0, 0]. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      }
      if (x === 0 && y === 0) return [0, 0];
      const length = Math.hypot(x, y);
      return [x / length, y / length];
    },
    firing() {
      return mouseDown || keys.has('Space');
    },
    /** Aim in canvas pixels; [0, 0] until the mouse has moved. */
    aim() {
      return mouseSeen ? [mouseX, mouseY] : null;
    },
    /** One-shot actions since the last call; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
