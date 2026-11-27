import Phaser from 'phaser';
import {
  ACTIONS,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  MOUSE_BUTTONS,
  STICK_DEADZONE
} from '../data/inputBindings.js';
import { normalizeMove } from '../core/math.js';
import { EventBus } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { services } from '../core/services.js';

const KeyCodes = Phaser.Input.Keyboard.KeyCodes;

/**
 * Action-based input layer. Gameplay asks "is `dodge` pressed?" and never
 * reads raw keys, so remapping, gamepads and (Phase 12) touch controls plug in
 * without touching gameplay code.
 *
 * One instance per scene (Phaser keys belong to a scene); it destroys itself
 * when the scene shuts down.
 *
 * Two ways to read input:
 *  - Polling (gameplay):  call update() once per frame, then isDown /
 *    justPressed / getMoveVector.
 *  - Events (menus):      on('pressed', action => ...). Keyboard presses are
 *    dispatched inside the browser's key handler, so actions that need a user
 *    gesture (fullscreen) work from the keyboard too.
 */
export class InputManager extends Phaser.Events.EventEmitter {
  constructor(scene, settings = services.settings, { globalHotkeys = true } = {}) {
    super();
    this.scene = scene;
    this.settings = settings;
    this.keyboard = scene.input.keyboard;
    this.keys = new Map(); // action -> Phaser.Input.Keyboard.Key[]
    this.state = new Map(ACTIONS.map((a) => [a, { down: false, pressed: false, released: false }]));
    this.moveVector = { x: 0, y: 0 };
    this.virtualMove = null; // Phase 12: virtual joystick writes here
    this.virtualActions = new Set();
    // Presses latched from events between two update() calls, so a tap that
    // is pressed AND released within one frame is never lost.
    this.pendingPresses = new Set();
    this.lastDevice = 'keyboard';
    // Device used for aiming: only the mouse (moving/clicking) or the right
    // stick change it, so pressing Q/E while aiming with the mouse keeps the
    // cursor aim. null = keyboard-only (aim follows facing).
    this.aimDevice = null;
    this.enabled = true;

    scene.input.mouse?.disableContextMenu();
    this.buildKeys();

    // Mouse aiming becomes active as soon as the mouse moves or clicks.
    this._onPointer = (pointer) => {
      if (pointer.wasTouch) this.setDevice('touch');
      else {
        this.setDevice('mouse');
        this.aimDevice = 'mouse';
      }
    };
    this._onPointerDown = (pointer) => {
      this._onPointer(pointer);
      if (!this.enabled || pointer.wasTouch) return;
      const name = ['MOUSE_LEFT', 'MOUSE_MIDDLE', 'MOUSE_RIGHT'][pointer.button];
      const bindings = this.getKeyBindings();
      for (const action of ACTIONS) {
        if ((bindings[action] ?? []).includes(name)) {
          this.pendingPresses.add(action);
          this.emit('pressed', action);
        }
      }
    };
    scene.input.on('pointermove', this._onPointer);
    scene.input.on('pointerdown', this._onPointerDown);

    if (globalHotkeys) {
      this.on('pressed', (action) => {
        if (action === 'fullscreen') services.display?.toggleFullscreen();
      });
    }

    this._onBindingsChanged = () => this.buildKeys();
    EventBus.on(Events.INPUT_BINDINGS_CHANGED, this._onBindingsChanged);
    scene.events.once('shutdown', () => this.destroy());
  }

  // ---------------------------------------------------------------- bindings
  getKeyBindings() {
    const overrides = this.settings?.get('input.keyBindings') ?? {};
    return { ...DEFAULT_KEY_BINDINGS, ...overrides };
  }

  getPadBindings() {
    const overrides = this.settings?.get('input.padBindings') ?? {};
    return { ...DEFAULT_PAD_BINDINGS, ...overrides };
  }

  static isValidBindingName(name) {
    return MOUSE_BUTTONS.includes(name) || KeyCodes[name] !== undefined;
  }

  buildKeys() {
    this.releaseKeys();
    if (!this.keyboard) return;
    const bindings = this.getKeyBindings();
    for (const action of ACTIONS) {
      const list = [];
      for (const name of bindings[action] ?? []) {
        if (MOUSE_BUTTONS.includes(name)) continue;
        const code = KeyCodes[name];
        if (code === undefined) {
          console.warn(`[Input] Unknown key "${name}" bound to "${action}" – ignored.`);
          continue;
        }
        const key = this.keyboard.addKey(code, true, false);
        const handled = new WeakSet(); // per action+key, since keys are shared between actions
        const onDown = (_key, event) => {
          // Phaser re-dispatches every queued key event each time a new one
          // arrives within the same frame, so two quick presses would replay
          // the first one. Each native event is handled exactly once.
          if (event) {
            if (handled.has(event)) return;
            handled.add(event);
          }
          if (!this.enabled) return;
          this.setDevice('keyboard');
          this.pendingPresses.add(action);
          this.emit('pressed', action);
        };
        key.on('down', onDown);
        list.push({ key, onDown });
      }
      this.keys.set(action, list);
    }
  }

  releaseKeys() {
    for (const list of this.keys.values()) {
      for (const { key, onDown } of list) {
        key.off('down', onDown);
        // Keys are shared between actions (e.g. SPACE = dodge + confirm), so
        // only remove the listener here; the scene's keyboard plugin owns keys.
      }
    }
    this.keys.clear();
  }

  /**
   * Remap an action. `names` is an array of key names / MOUSE_* ids.
   * Persisted to settings and applied to every live InputManager.
   */
  rebind(action, names) {
    if (!ACTIONS.includes(action)) throw new Error(`Unknown action "${action}"`);
    const valid = names.filter((n) => InputManager.isValidBindingName(n));
    const overrides = { ...(this.settings.get('input.keyBindings') ?? {}), [action]: valid };
    this.settings.set('input.keyBindings', overrides);
    EventBus.emit(Events.INPUT_BINDINGS_CHANGED, action);
    return valid;
  }

  resetBindings() {
    this.settings.set('input.keyBindings', {});
    this.settings.set('input.padBindings', {});
    EventBus.emit(Events.INPUT_BINDINGS_CHANGED, '*');
  }

  // ----------------------------------------------------------------- polling
  getPad() {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) return null;
    return gp.pad1 ?? gp.getAll()[0] ?? null;
  }

  isMouseDown(name, pointer) {
    if (!pointer) return false;
    if (name === 'MOUSE_LEFT') return pointer.leftButtonDown();
    if (name === 'MOUSE_RIGHT') return pointer.rightButtonDown();
    if (name === 'MOUSE_MIDDLE') return pointer.middleButtonDown();
    return false;
  }

  update() {
    const pointer = this.scene.input.activePointer;
    const pad = this.getPad();
    const keyBindings = this.getKeyBindings();
    const padBindings = this.getPadBindings();

    for (const action of ACTIONS) {
      const s = this.state.get(action);
      const wasDown = s.down;
      let keyDown = false;
      for (const { key } of this.keys.get(action) ?? []) if (key.isDown) keyDown = true;

      let mouseDown = false;
      for (const name of keyBindings[action] ?? []) {
        if (MOUSE_BUTTONS.includes(name) && this.isMouseDown(name, pointer)) mouseDown = true;
      }

      let padDown = false;
      if (pad) for (const idx of padBindings[action] ?? []) if (pad.buttons[idx]?.pressed) padDown = true;

      const down = this.enabled && (keyDown || mouseDown || padDown || this.virtualActions.has(action));
      const latched = this.enabled && this.pendingPresses.has(action);
      s.pressed = (down && !wasDown) || latched;
      s.released = (!down && wasDown) || (latched && !down);
      s.down = down;

      // Keyboard and mouse presses were already emitted from their event
      // handlers; only polled sources (gamepad, virtual) emit here.
      if (s.pressed && !latched && (padDown || this.virtualActions.has(action))) {
        if (padDown) this.setDevice('gamepad');
        this.emit('pressed', action);
      }
    }
    this.pendingPresses.clear();

    // Movement: keyboard/d-pad digital axes, analog stick, or virtual joystick.
    let x = (this.isDown('moveRight') ? 1 : 0) - (this.isDown('moveLeft') ? 1 : 0);
    let y = (this.isDown('moveDown') ? 1 : 0) - (this.isDown('moveUp') ? 1 : 0);
    let move = normalizeMove(x, y);
    if (pad && this.enabled) {
      const stick = normalizeMove(pad.leftStick.x, pad.leftStick.y, STICK_DEADZONE);
      if (Math.hypot(stick.x, stick.y) > Math.hypot(move.x, move.y)) {
        move = stick;
        this.setDevice('gamepad');
      }
    }
    if (this.virtualMove && this.enabled) {
      const v = normalizeMove(this.virtualMove.x, this.virtualMove.y, 0.1);
      if (Math.hypot(v.x, v.y) > 0) move = v;
    }
    this.moveVector = move;
  }

  isDown(action) {
    return this.state.get(action)?.down ?? false;
  }

  justPressed(action) {
    return this.state.get(action)?.pressed ?? false;
  }

  justReleased(action) {
    return this.state.get(action)?.released ?? false;
  }

  getMoveVector() {
    return this.moveVector;
  }

  /** World-space point under the mouse. */
  getAimWorldPoint(camera = this.scene.cameras.main) {
    const p = this.scene.input.activePointer;
    return camera.getWorldPoint(p.x, p.y);
  }

  /**
   * Unit aim direction from a world-space origin, or null when the player
   * has no explicit aim (keyboard-only): callers then use their facing.
   *  - gamepad: right stick (falls back to null inside the deadzone)
   *  - mouse:   toward the cursor
   */
  getAimVector(originX, originY, camera = this.scene.cameras.main) {
    const pad = this.getPad();
    if (pad) {
      const v = normalizeMove(pad.rightStick.x, pad.rightStick.y, STICK_DEADZONE);
      const len = Math.hypot(v.x, v.y);
      if (len > 0) {
        this.aimDevice = 'gamepad';
        return { x: v.x / len, y: v.y / len };
      }
      if (this.aimDevice === 'gamepad') return null; // stick released: aim with facing
    }
    if (this.aimDevice === 'mouse') {
      const p = this.getAimWorldPoint(camera);
      const dx = p.x - originX;
      const dy = p.y - originY;
      const len = Math.hypot(dx, dy);
      if (len > 0.5) return { x: dx / len, y: dy / len };
    }
    return null;
  }

  // ------------------------------------------------------ virtual (touch) API
  setVirtualMove(x, y) {
    this.virtualMove = { x, y };
    this.setDevice('touch');
  }

  setVirtualAction(action, down) {
    if (down) this.virtualActions.add(action);
    else this.virtualActions.delete(action);
  }

  setDevice(device) {
    if (this.lastDevice === device) return;
    this.lastDevice = device;
    EventBus.emit(Events.INPUT_DEVICE_CHANGED, device);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.pendingPresses.clear();
      for (const s of this.state.values()) Object.assign(s, { down: false, pressed: false, released: false });
    }
  }

  destroy() {
    EventBus.off(Events.INPUT_BINDINGS_CHANGED, this._onBindingsChanged);
    this.scene.input?.off('pointermove', this._onPointer);
    this.scene.input?.off('pointerdown', this._onPointerDown);
    this.releaseKeys();
    this.removeAllListeners();
  }
}
