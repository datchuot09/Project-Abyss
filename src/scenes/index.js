// Scenes registered with Phaser in the current build. Scenes from the design
// document that are not implemented yet (Hub, Boss, GameOver, Victory) are
// intentionally absent – see SceneKeys.js and README "Phase status".
import { BootScene } from './BootScene.js';
import { PreloadScene } from './PreloadScene.js';
import { MainMenuScene } from './MainMenuScene.js';
import { LoadingScene } from './LoadingScene.js';
import { DungeonScene } from './DungeonScene.js';

export const SCENES = [BootScene, PreloadScene, MainMenuScene, LoadingScene, DungeonScene];
