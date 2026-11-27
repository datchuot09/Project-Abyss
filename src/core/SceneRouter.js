// Central scene transitions: fade out, start the next scene, never twice.
export const SceneRouter = {
  goTo(scene, key, data = {}, { fadeMs = 250, color = [0, 0, 0] } = {}) {
    if (scene.__routing) return false;
    scene.__routing = true;
    const cam = scene.cameras.main;
    if (!cam || fadeMs <= 0) {
      scene.scene.start(key, data);
      return true;
    }
    cam.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
    cam.fadeOut(fadeMs, ...color);
    return true;
  },

  /** Call in a scene's create() to reset the guard and fade in. */
  enter(scene, { fadeMs = 250 } = {}) {
    scene.__routing = false;
    if (fadeMs > 0) scene.cameras.main.fadeIn(fadeMs, 0, 0, 0);
  }
};
