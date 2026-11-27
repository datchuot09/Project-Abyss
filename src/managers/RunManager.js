import { EventBus } from '../core/EventBus.js';
import { Events } from '../core/Events.js';
import { services } from '../core/services.js';
import { RunState } from '../systems/RunState.js';
import { AssetManager } from './AssetManager.js';

/**
 * Owns the current run (services.run). The single place that changes EXP,
 * buffs and stamina, and announces every change on the EventBus.
 * Stamina is changed ONLY through changeStamina() (design doc 11.9).
 */
export const RunManager = {
  startNewRun(scene, characterId = 'wanderer') {
    const character = AssetManager.getCharacter(scene, characterId);
    const run = new RunState({
      characterId,
      levelCurve: scene.cache.json.get('levels'),
      staminaConfig: scene.cache.json.get('stamina_config'),
      staminaMax: character.stats.stamina
    });
    run.stamina.onChange((e) => EventBus.emit(Events.STAMINA_CHANGED, e));
    services.run = run;
    EventBus.emit(Events.RUN_STARTED, run);
    return run;
  },

  ensureRun(scene) {
    return services.run ?? this.startNewRun(scene);
  },

  get run() {
    return services.run;
  },

  buffDefs(scene) {
    return scene.cache.json.get('buffs');
  },

  grantExp(amount, source = null) {
    const run = services.run;
    if (!run || !(amount > 0)) return 0;
    const gained = run.addExp(amount);
    EventBus.emit(Events.RUN_EXP_CHANGED, { level: run.level, exp: run.exp, next: run.expToNext(), gained: amount, source });
    if (gained > 0) EventBus.emit(Events.RUN_LEVEL_UP, { level: run.level, pending: run.pendingLevelUps });
    return gained;
  },

  rollChoices(scene, count = 3) {
    return services.run.rollBuffChoices(this.buffDefs(scene).buffs, count);
  },

  /** Apply a chosen level-up buff. Consumes one pending level-up. */
  chooseBuff(scene, buffId) {
    const run = services.run;
    const def = this.buffDefs(scene).buffs[buffId];
    if (!run || !def || run.pendingLevelUps <= 0) return false;
    if (!run.addBuff(def)) return false;
    run.pendingLevelUps--;
    EventBus.emit(Events.RUN_BUFFS_CHANGED, { buffs: { ...run.buffs }, chosen: def });
    return true;
  },

  /** Central stamina API. Negative = loss. Returns the applied delta. */
  changeStamina(delta, reason) {
    return services.run ? services.run.stamina.change(delta, reason) : 0;
  },

  endRun() {
    if (services.run) services.run.endedAt = Date.now();
    return services.run;
  }
};
