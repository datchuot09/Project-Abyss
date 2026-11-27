// Minimal finite state machine used by the player and every enemy AI.
// states: { name: { enter?(data), update?(dt), exit?() } } – `this` is the owner.
export class StateMachine {
  constructor(owner, states, initial, initialData) {
    this.owner = owner;
    this.states = states;
    this.name = null;
    this.previous = null;
    this.elapsed = 0;
    this.history = []; // last few transitions, for debugging/tests
    if (initial) this.set(initial, initialData);
  }

  is(...names) {
    return names.includes(this.name);
  }

  set(name, data) {
    const next = this.states[name];
    if (!next) throw new Error(`StateMachine: unknown state "${name}"`);
    const cur = this.states[this.name];
    cur?.exit?.call(this.owner, name);
    this.previous = this.name;
    this.name = name;
    this.elapsed = 0;
    this.history.push(name);
    if (this.history.length > 12) this.history.shift();
    next.enter?.call(this.owner, data);
  }

  update(dt) {
    this.elapsed += dt;
    this.states[this.name]?.update?.call(this.owner, dt);
  }
}
