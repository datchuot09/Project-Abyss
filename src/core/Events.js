// Event names used on the global EventBus. Systems communicate through these
// instead of importing each other directly (avoids circular dependencies).
export const Events = Object.freeze({
  SETTINGS_CHANGED: 'settings:changed',
  DISPLAY_CHANGED: 'display:changed',
  FULLSCREEN_CHANGED: 'display:fullscreen',
  SCENE_READY: 'scene:ready',
  FLOOR_LOADED: 'floor:loaded',
  INPUT_DEVICE_CHANGED: 'input:device',
  INPUT_BINDINGS_CHANGED: 'input:bindings'
});
