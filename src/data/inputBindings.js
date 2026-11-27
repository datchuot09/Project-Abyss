// Default control scheme (design doc 4.2). Players can remap through
// InputManager.rebind(); overrides are persisted by SettingsManager.
//
// Keyboard names are Phaser KeyCodes names. Mouse buttons use MOUSE_*.
// Gamepad entries are W3C "standard mapping" button indices:
//   0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start,
//   12 D-Up, 13 D-Down, 14 D-Left, 15 D-Right

export const ACTIONS = Object.freeze([
  'moveUp', 'moveDown', 'moveLeft', 'moveRight',
  'attack', 'secondary', 'dodge', 'skill1', 'skill2', 'ultimate',
  'inventory', 'pause', 'interact', 'confirm', 'back',
  'debug', 'fullscreen'
]);

export const DEFAULT_KEY_BINDINGS = Object.freeze({
  moveUp: ['W', 'UP'],
  moveDown: ['S', 'DOWN'],
  moveLeft: ['A', 'LEFT'],
  moveRight: ['D', 'RIGHT'],
  attack: ['MOUSE_LEFT'],
  secondary: ['MOUSE_RIGHT'],
  dodge: ['SPACE'],
  skill1: ['Q'],
  skill2: ['E'],
  ultimate: ['R'],
  inventory: ['I'],
  pause: ['ESC'],
  interact: ['F'],
  confirm: ['ENTER', 'SPACE'],
  back: ['ESC', 'BACKSPACE'],
  debug: ['F3'],
  fullscreen: ['F11']
});

export const DEFAULT_PAD_BINDINGS = Object.freeze({
  moveUp: [12],
  moveDown: [13],
  moveLeft: [14],
  moveRight: [15],
  attack: [7, 2],
  secondary: [6],
  dodge: [0],
  skill1: [4],
  skill2: [5],
  ultimate: [3],
  inventory: [8],
  pause: [9],
  interact: [1],
  confirm: [0],
  back: [1],
  debug: [],
  fullscreen: []
});

export const MOUSE_BUTTONS = Object.freeze(['MOUSE_LEFT', 'MOUSE_RIGHT', 'MOUSE_MIDDLE']);
export const STICK_DEADZONE = 0.2;
