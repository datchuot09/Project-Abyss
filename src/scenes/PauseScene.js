import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_KEY } from '../core/constants.js';
import { InputManager } from '../managers/InputManager.js';
import { MenuList } from '../ui/MenuList.js';
import { services } from '../core/services.js';
import { UI } from '../ui/theme.js';

/** Pause menu overlay (ESC). The dungeon is frozen underneath. data: { returnTo } */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.PAUSE);
  }

  init(data) {
    this.returnTo = data.returnTo ?? SceneKeys.DUNGEON;
    this.confirmQuit = false;
  }

  create() {
    this.input.setDefaultCursor('default');
    this.controls = new InputManager(this);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.7).setOrigin(0);
    this.add.bitmapText(GAME_WIDTH / 2, 60, FONT_KEY, 'PAUSED', 11).setOrigin(0.5).setScale(2).setTint(UI.text);
    const run = services.run;
    if (run) {
      this.add.bitmapText(GAME_WIDTH / 2, 84, FONT_KEY, `Floor ${run.floor}   Level ${run.level}   Kills ${run.kills}`, 11).setOrigin(0.5).setTint(UI.textDim);
    }
    this.menu = new MenuList(this, this.controls, {
      x: GAME_WIDTH / 2,
      y: 110,
      items: [
        { id: 'resume', label: 'Resume', onSelect: () => this.resume() },
        {
          id: 'quit',
          label: () => (this.confirmQuit ? 'Abandon run? Press again' : 'Abandon Run'),
          onSelect: () => {
            if (!this.confirmQuit) {
              this.confirmQuit = true;
              return;
            }
            services.run = null;
            this.scene.stop(this.returnTo);
            this.scene.start(SceneKeys.MAIN_MENU);
          }
        }
      ]
    });
    this.add.bitmapText(GAME_WIDTH / 2, 176, FONT_KEY,
      'LMB attack   RMB arcane bolt   Space dodge\nQ rune rush   E frost sigil   R abyssal eclipse', 11)
      .setOrigin(0.5, 0).setCenterAlign().setTint(0x6d6680);
    this.controls.on('pressed', (a) => {
      if (a === 'pause') this.resume();
      if (a === 'moveDown' || a === 'moveUp') this.confirmQuit = false;
    });
  }

  resume() {
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }

  update() {
    this.controls.update(); // gamepad buttons are polled
  }
}
