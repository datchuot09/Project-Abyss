// Every scene from the design document has a stable key here.
// `implemented` documents which ones exist in the current build so nothing
// pretends to work before it does (see README "Phase status").
export const SceneKeys = Object.freeze({
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MAIN_MENU: 'MainMenuScene',
  HUB: 'HubScene', // Phase 9
  DUNGEON: 'DungeonScene',
  BOSS: 'BossScene', // Phase 8
  LOADING: 'LoadingScene',
  GAME_OVER: 'GameOverScene',
  LEVEL_UP: 'LevelUpScene', // overlay
  PAUSE: 'PauseScene', // overlay
  VICTORY: 'VictoryScene' // Phase 8
});
