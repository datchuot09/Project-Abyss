// Event names used on the global EventBus. Systems communicate through these
// instead of importing each other directly (avoids circular dependencies).
export const Events = Object.freeze({
  SETTINGS_CHANGED: 'settings:changed',
  DISPLAY_CHANGED: 'display:changed',
  FULLSCREEN_CHANGED: 'display:fullscreen',
  SCENE_READY: 'scene:ready',
  FLOOR_LOADED: 'floor:loaded',
  INPUT_DEVICE_CHANGED: 'input:device',
  INPUT_BINDINGS_CHANGED: 'input:bindings',
  // Combat (Phase 2)
  COMBAT_HIT: 'combat:hit', // { target, attacker, damage, crit, type, element, x, y, team }
  COMBAT_EVADED: 'combat:evaded', // hit ignored by i-frames
  ENTITY_DIED: 'entity:died', // { entity, team, killer }
  PLAYER_HP_CHANGED: 'player:hp', // { current, max, delta }
  PLAYER_DIED: 'player:died',
  ENEMIES_CLEARED: 'enemies:cleared',
  STATUS_APPLIED: 'status:applied', // { target, id }
  // Run progression (Phase 3)
  RUN_STARTED: 'run:started',
  RUN_EXP_CHANGED: 'run:exp', // { level, exp, next, gained }
  RUN_LEVEL_UP: 'run:levelup', // { level, pending }
  RUN_BUFFS_CHANGED: 'run:buffs', // { buffs }
  STAMINA_CHANGED: 'run:stamina', // { current, max, delta, effects, tierChanged }
  PLAYER_STATS_CHANGED: 'player:stats',
  FINISHER_DONE: 'death:finisher'
});
