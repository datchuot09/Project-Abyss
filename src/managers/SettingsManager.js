// Player settings persisted in LocalStorage (design doc 2.1).
// Run/permanent progression goes to IndexedDB in Phase 11 – not here.
const STORAGE_KEY = 'abyss.settings';
const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = Object.freeze({
  version: SCHEMA_VERSION,
  video: {
    scaleMode: 'integer', // 'integer' | 'fit'
    showDebug: false
  },
  audio: {
    master: 1,
    music: 0.8,
    sfx: 0.8,
    muted: false
  },
  input: {
    keyBindings: {}, // per-action overrides of DEFAULT_KEY_BINDINGS
    padBindings: {}
  }
});

function deepMerge(base, override) {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return override === undefined ? base : override;
  }
  const out = { ...base };
  if (override && typeof override === 'object') {
    for (const k of Object.keys(override)) {
      out[k] = k in base ? deepMerge(base[k], override[k]) : override[k];
    }
  }
  return out;
}

export class SettingsManager {
  /** @param {Storage|null} storage injectable for tests */
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null, onChange = null) {
    this.storage = storage;
    this.onChange = onChange;
    this.data = this.load();
  }

  load() {
    if (!this.storage) return structuredClone(DEFAULT_SETTINGS);
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SETTINGS);
      const parsed = JSON.parse(raw);
      const merged = deepMerge(structuredClone(DEFAULT_SETTINGS), parsed);
      merged.version = SCHEMA_VERSION;
      return merged;
    } catch (err) {
      console.warn('[Settings] Corrupted settings, falling back to defaults.', err);
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  save() {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[Settings] Could not persist settings.', err);
    }
  }

  get(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this.data);
  }

  set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] ??= {}), this.data);
    target[last] = value;
    this.save();
    this.onChange?.(path, value);
  }

  reset() {
    this.data = structuredClone(DEFAULT_SETTINGS);
    this.save();
    this.onChange?.('*', this.data);
  }
}
