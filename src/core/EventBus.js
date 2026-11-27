import Phaser from 'phaser';

/** Global event bus shared by all systems and scenes. */
export const EventBus = new Phaser.Events.EventEmitter();

/**
 * Subscribe a scene to a bus event; the listener is removed automatically when
 * the scene shuts down, so scene restarts never leak duplicate listeners.
 */
export function listen(scene, event, fn, context = scene) {
  EventBus.on(event, fn, context);
  scene.events.once('shutdown', () => EventBus.off(event, fn, context));
}
