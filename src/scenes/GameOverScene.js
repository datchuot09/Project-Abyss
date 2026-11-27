import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_KEY } from '../core/constants.js';
import { SceneRouter } from '../core/SceneRouter.js';
import { InputManager } from '../managers/InputManager.js';
import { RunManager } from '../managers/RunManager.js';
import { MenuList } from '../ui/MenuList.js';
import { services } from '../core/services.js';
import { UI } from '../ui/theme.js';

function formatTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Game Over (design doc 5.4 / 15.4): the run ends, run buffs are gone,
 * permanent progression (Phase 9/11) is untouched. Shows the run summary.
 * data: { summary: RunState.toJSON(), cause }
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.GAME_OVER);
  }

  init(data) {
    this.summary = data.summary ?? {};
    this.cause = data.cause ?? 'the abyss';
  }

  create() {
    SceneRouter.enter(this, { fadeMs: 600 });
    this.input.setDefaultCursor('default');
    services.run = null; // the run is over – a new one starts from "Rise Again"
    this.controls = new InputManager(this);
    const cx = GAME_WIDTH / 2;

    const g = this.add.graphics();
    for (let i = 0; i < 6; i++) g.fillStyle([0x050206, 0x080309, 0x0c040c, 0x10050f, 0x160612, 0x1e0815][i]).fillRect(0, i * 45, GAME_WIDTH, 45);
    this.add.particles(0, GAME_HEIGHT, 'px_ember', {
      x: { min: 0, max: GAME_WIDTH }, lifespan: { min: 2500, max: 5000 }, speedY: { min: -10, max: -24 },
      alpha: { start: 0.8, end: 0 }, tint: [0x8a1020, 0x5a0a12, 0xd9455f], frequency: 160
    });

    this.add.bitmapText(cx, 44, FONT_KEY, 'YOU HAVE FALLEN', 11).setOrigin(0.5).setScale(3).setTint(UI.danger);
    this.add.bitmapText(cx, 70, FONT_KEY, `Slain by ${this.cause} on Floor ${this.summary.floor ?? 1}`, 11).setOrigin(0.5).setTint(UI.textDim);

    const s = this.summary;
    const lines = [
      ['Level reached', s.level ?? 1],
      ['Monsters slain', s.kills ?? 0],
      ['Damage dealt', s.damageDealt ?? 0],
      ['Damage taken', s.damageTaken ?? 0],
      ['Time survived', formatTime((s.endedAt ?? Date.now()) - (s.startedAt ?? Date.now()))],
      ['Blessings', Object.values(s.buffs ?? {}).reduce((a, b) => a + b, 0)]
    ];
    lines.forEach(([k, v], i) => {
      this.add.bitmapText(cx - 70, 92 + i * 12, FONT_KEY, k, 11).setTint(UI.textDim);
      this.add.bitmapText(cx + 70, 92 + i * 12, FONT_KEY, `${v}`, 11).setOrigin(1, 0).setTint(UI.text);
    });

    this.menu = new MenuList(this, this.controls, {
      x: cx,
      y: 176,
      items: [
        {
          id: 'retry',
          label: 'Rise Again',
          onSelect: () => {
            this.menu.setEnabled(false);
            RunManager.startNewRun(this);
            SceneRouter.goTo(this, SceneKeys.LOADING, { floorId: 'test_chamber', floorNumber: 1, next: SceneKeys.DUNGEON });
          }
        },
        { id: 'menu', label: 'Main Menu', onSelect: () => SceneRouter.goTo(this, SceneKeys.MAIN_MENU) }
      ]
    });
    this.add.bitmapText(cx, GAME_HEIGHT - 14, FONT_KEY, 'The run is over. Its blessings fade with you.', 11).setOrigin(0.5).setTint(0x5d566b);
  }

  update() {
    this.controls.update();
  }
}
