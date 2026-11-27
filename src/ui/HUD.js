import Phaser from 'phaser';
import { DEPTH, FONT_KEY, GAME_WIDTH, GAME_HEIGHT } from '../core/constants.js';
import { listen } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { UI } from './theme.js';

// Layout (logical pixels, top-left corner – design doc section 5)
const X = 6;
const Y = 6;
const AV = 24; // avatar box
const BAR_X = X + AV + 4;
const BAR_W = 84;
const ROWS = { hp: Y + 1, exp: Y + 10, st: Y + 18 };
const H = { hp: 6, exp: 4, st: 4 };
const TEXT_X = BAR_X + BAR_W + 4;
const LOW_HP = 0.3;

const STAMINA_COLORS = {
  normal: 0x4fc8b0,
  weary: 0xd9c04a,
  exhausted: 0xe08a3a,
  collapsing: 0xd9455f,
  broken: 0x9a1028
};

/**
 * Player HUD. Pure presentation: it only listens to events and reads
 * read-only getters (player.getSkillHud(), run state); it never changes
 * gameplay state.
 *  - avatar + level badge
 *  - HP (trail + low-HP pulse), EXP (level progress), Stamina (with the
 *    50 threshold tick and negative values shown as a red debt bar)
 *  - active run buffs with stack counts
 *  - skill bar (RMB / Space / Q / E / R) with cooldowns
 *  - exhaustion overlay at Stamina <= -100 (red corners + cracks)
 */
export class HUD {
  constructor(scene, player, run, { keyLabel = (a) => a } = {}) {
    this.scene = scene;
    this.player = player;
    this.run = run;
    this.keyLabel = keyLabel;
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH.UI);

    // --- exhaustion overlay (below the HUD itself)
    this.vignette = scene.add.image(0, 0, 'vignette_red').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.UI - 2).setVisible(false);
    this.cracks = scene.add.image(0, 0, 'screen_cracks').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.UI - 1).setVisible(false);

    // --- avatar
    this.frame = fixed(scene.add.graphics());
    this.frame.fillStyle(0x07060b).fillRect(X - 1, Y - 1, AV + 2, AV + 2)
      .fillStyle(UI.panelEdge).fillRect(X, Y, AV, AV)
      .fillStyle(0x120f18).fillRect(X + 1, Y + 1, AV - 2, AV - 2);
    this.avatar = fixed(scene.add.image(X + AV / 2, Y + AV / 2 + 3, player.def.sprite.texture, 0).setCrop(4, 1, 16, 18));
    this.levelBadge = fixed(scene.add.bitmapText(X + AV - 1, Y + AV - 6, FONT_KEY, '', 11).setOrigin(1, 0).setTint(UI.accentHot));

    // --- bars + labels
    this.bars = fixed(scene.add.graphics());
    this.hpText = fixed(scene.add.bitmapText(TEXT_X, ROWS.hp - 1, FONT_KEY, '', 11));
    this.expText = fixed(scene.add.bitmapText(TEXT_X, ROWS.exp - 2, FONT_KEY, '', 11));
    this.stText = fixed(scene.add.bitmapText(TEXT_X, ROWS.st - 2, FONT_KEY, '', 11));

    // --- buffs row
    this.buffIcons = [];
    this.buffBg = fixed(scene.add.graphics());

    // --- skill bar
    this.skillGfx = fixed(scene.add.graphics());
    this.skillSlots = player.getSkillHud().map((s, i, all) => {
      const x = Math.round(GAME_WIDTH / 2 - (all.length * 24) / 2 + i * 24 + 2);
      const y = GAME_HEIGHT - 24;
      return {
        ...s, x, y,
        icon: fixed(scene.add.image(x + 10, y + 10, 'icons', s.icon)),
        key: fixed(scene.add.bitmapText(x + 10, y - 9, FONT_KEY, keyLabel(s.action), 11).setOrigin(0.5, 0).setTint(UI.textDim)),
        cd: fixed(scene.add.bitmapText(x + 10, y + 6, FONT_KEY, '', 11).setOrigin(0.5, 0).setDepth(DEPTH.UI + 1))
      };
    });

    // --- state
    this.hp = { value: player.health.current, max: player.health.max, trail: player.health.current, flash: 0 };
    this.st = { value: run.stamina.current, max: run.stamina.max, effects: run.stamina.effects, flash: 0 };
    this.expFlash = 0;

    listen(scene, Events.PLAYER_HP_CHANGED, this.onHp, this);
    listen(scene, Events.RUN_EXP_CHANGED, () => { this.expFlash = 0.25; this.draw(); }, this);
    listen(scene, Events.RUN_LEVEL_UP, () => this.draw(), this);
    listen(scene, Events.STAMINA_CHANGED, this.onStamina, this);
    listen(scene, Events.RUN_BUFFS_CHANGED, () => this.drawBuffs(), this);
    this.draw();
    this.drawBuffs();
  }

  onHp({ current, max, delta }) {
    this.hp.max = max;
    this.hp.value = current;
    if (delta > 0 || current > this.hp.trail) this.hp.trail = current;
    else if (delta < 0) this.hp.flash = 0.15;
    this.draw();
  }

  onStamina({ current, max, effects }) {
    this.st.value = current;
    this.st.max = max;
    this.st.effects = effects;
    this.st.flash = 0.3;
    this.draw();
  }

  update(dt) {
    if (this.hp.trail > this.hp.value) this.hp.trail = Math.max(this.hp.value, this.hp.trail - this.hp.max * 0.6 * dt);
    this.hp.flash = Math.max(0, this.hp.flash - dt);
    this.st.flash = Math.max(0, this.st.flash - dt);
    this.expFlash = Math.max(0, this.expFlash - dt);
    this.draw();
    this.drawSkills();
    this.updateOverlay();
  }

  bar(g, x, y, w, h, ratio, color, back = 0x1b1724) {
    g.fillStyle(0x07060b).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(back).fillRect(x, y, w, h);
    const fw = Math.round(w * Phaser.Math.Clamp(ratio, 0, 1));
    if (fw > 0) {
      g.fillStyle(color).fillRect(x, y, fw, h);
      g.fillStyle(Phaser.Display.Color.ValueToColor(color).lighten(25).color).fillRect(x, y, fw, 1);
    }
  }

  draw() {
    const g = this.bars.clear();
    const t = this.scene.time.now;

    // HP
    const hpRatio = this.hp.value / this.hp.max;
    const low = hpRatio <= LOW_HP && hpRatio > 0;
    const pulse = low ? 0.5 + 0.5 * Math.sin(t / 120) : 0;
    g.fillStyle(0x07060b).fillRect(BAR_X - 1, ROWS.hp - 1, BAR_W + 2, H.hp + 2);
    g.fillStyle(0x2a0c12).fillRect(BAR_X, ROWS.hp, BAR_W, H.hp);
    g.fillStyle(0xf2e6c8).fillRect(BAR_X, ROWS.hp, Math.round(BAR_W * Phaser.Math.Clamp(this.hp.trail / this.hp.max, 0, 1)), H.hp);
    const hpColor = this.hp.flash > 0 ? 0xffffff : low ? Phaser.Display.Color.GetColor(200 + 55 * pulse, 40, 60) : 0xc2304a;
    const hw = Math.round(BAR_W * Phaser.Math.Clamp(hpRatio, 0, 1));
    g.fillStyle(hpColor).fillRect(BAR_X, ROWS.hp, hw, H.hp);
    g.fillStyle(0xff8a9a).fillRect(BAR_X, ROWS.hp, hw, 1);
    this.hpText.setText(`${Math.ceil(this.hp.value)}/${this.hp.max}`).setTint(low ? 0xff8a8a : UI.text);

    // EXP
    const run = this.run;
    const next = run.expToNext();
    this.bar(g, BAR_X, ROWS.exp, BAR_W, H.exp, run.exp / next, this.expFlash > 0 ? 0xfff0a0 : 0xd9b25f, 0x1e1a12);
    this.expText.setText(`Lv ${run.level}`).setTint(UI.accent);
    this.levelBadge.setText(`${run.level}`);

    // Stamina (negative values grow a red "debt" bar toward -100)
    const s = this.st;
    const tier = s.effects?.tier ?? 'normal';
    const color = s.flash > 0 ? 0xffffff : STAMINA_COLORS[tier] ?? STAMINA_COLORS.normal;
    if (s.value >= 0) {
      this.bar(g, BAR_X, ROWS.st, BAR_W, H.st, s.value / s.max, color, 0x10201e);
    } else {
      this.bar(g, BAR_X, ROWS.st, BAR_W, H.st, 0, color, 0x10201e);
      const debt = Math.round(BAR_W * Math.min(1, -s.value / 100));
      const blink = tier === 'broken' && Math.floor(t / 180) % 2;
      g.fillStyle(blink ? 0xff3040 : color).fillRect(BAR_X, ROWS.st, debt, H.st);
      g.fillStyle(0x07060b);
      for (let x = BAR_X + 3; x < BAR_X + debt; x += 6) g.fillRect(x, ROWS.st + 1, 1, H.st - 2); // hatching = debt
    }
    // threshold tick at 50
    const tickX = BAR_X + Math.round(BAR_W * (50 / s.max));
    g.fillStyle(0xe8e0f0, 0.8).fillRect(tickX, ROWS.st - 1, 1, H.st + 2);
    this.stText.setText(`ST ${s.value}`).setTint(tier === 'normal' ? 0x9fe8d8 : color);
  }

  drawBuffs() {
    for (const b of this.buffIcons) { b.icon.destroy(); b.count.destroy(); }
    this.buffIcons = [];
    const g = this.buffBg.clear();
    const data = this.scene.cache.json.get('buffs')?.buffs ?? {};
    let x = X;
    const y = Y + AV + 4;
    for (const [id, stacks] of Object.entries(this.run.buffs)) {
      const def = data[id];
      if (!def || stacks <= 0) continue;
      g.fillStyle(0x07060b, 0.7).fillRect(x - 1, y - 1, 18, 18);
      const icon = this.scene.add.image(x + 8, y + 8, 'icons', def.icon).setScrollFactor(0).setDepth(DEPTH.UI);
      const count = this.scene.add.bitmapText(x + 17, y + 9, FONT_KEY, `${stacks}`, 11).setOrigin(1, 0)
        .setScrollFactor(0).setDepth(DEPTH.UI + 1).setTint(stacks >= def.maxStacks ? UI.accentHot : UI.text);
      this.buffIcons.push({ id, icon, count });
      x += 20;
    }
  }

  drawSkills() {
    const g = this.skillGfx.clear();
    const states = this.player.getSkillHud();
    this.skillSlots.forEach((slot, i) => {
      const st = states[i];
      const ready = st.remaining <= 0;
      g.fillStyle(0x07060b).fillRect(slot.x - 1, slot.y - 1, 22, 22);
      g.fillStyle(ready ? UI.panelEdge : 0x2a2433).fillRect(slot.x, slot.y, 20, 20);
      g.fillStyle(0x120f18).fillRect(slot.x + 1, slot.y + 1, 18, 18);
      slot.icon.setAlpha(ready ? 1 : 0.45);
      if (!ready && st.total > 0) {
        const h = Math.ceil(18 * Phaser.Math.Clamp(st.remaining / st.total, 0, 1));
        g.fillStyle(0x000000, 0.55).fillRect(slot.x + 1, slot.y + 1, 18, h);
      }
      slot.cd.setText(!ready && st.remaining >= 1 ? `${Math.ceil(st.remaining)}` : '');
    });
  }

  updateOverlay() {
    const critical = Boolean(this.st.effects?.critical) && !this.player.isDead;
    this.vignette.setVisible(critical);
    this.cracks.setVisible(critical);
    if (critical) this.vignette.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(this.scene.time.now / 260)));
  }
}
