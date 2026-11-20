// Input — one clear job: keyboard + mouse state, and the screen position of the mouse.
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const pressed = new Set(); // keys pressed since last consume (edge-triggered)
  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) { mouse.down = true; mouse.clicked = true; onMouseMove(e); }
  function onMouseUp() { mouse.down = false; }
  function onBlur() { keys.clear(); mouse.down = false; }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  return {
    keys, mouse,
    down(code) { return keys.has(code); },
    // True once per physical press; call after the frame's logic.
    wasPressed(code) { return pressed.has(code); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
    // WASD or arrows as a -1..1 axis pair.
    moveAxis() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    detach() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
