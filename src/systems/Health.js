// Centralised HP model (design doc 11.9): every HP change in the game goes
// through an instance of this class. Pure – no Phaser.
export class Health {
  constructor(max, current = max) {
    if (!(max > 0)) throw new Error('Health: max must be > 0');
    this.max = max;
    this.current = Math.min(max, Math.max(0, current));
    this.invulnerable = false;
    this.listeners = new Set();
  }

  get ratio() {
    return this.current / this.max;
  }

  get isDead() {
    return this.current <= 0;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(delta, source, kind) {
    for (const fn of this.listeners) fn({ current: this.current, max: this.max, delta, source, kind });
  }

  /** Returns the HP actually removed (0 if dead or invulnerable). */
  damage(amount, source = null) {
    if (this.isDead || this.invulnerable || !(amount > 0)) return 0;
    const applied = Math.min(this.current, Math.round(amount));
    this.current -= applied;
    this.emit(-applied, source, this.isDead ? 'death' : 'damage');
    return applied;
  }

  /** Returns the HP actually restored. Dead entities cannot be healed. */
  heal(amount, source = null) {
    if (this.isDead || !(amount > 0)) return 0;
    const applied = Math.min(this.max - this.current, Math.round(amount));
    if (applied <= 0) return 0;
    this.current += applied;
    this.emit(applied, source, 'heal');
    return applied;
  }

  setMax(max, { keepRatio = true } = {}) {
    if (!(max > 0)) return;
    const ratio = this.ratio;
    this.max = max;
    this.current = keepRatio ? Math.max(this.isDead ? 0 : 1, Math.round(max * ratio)) : Math.min(this.current, max);
    this.emit(0, null, 'max');
  }

  reset() {
    this.current = this.max;
    this.emit(0, null, 'reset');
  }
}
