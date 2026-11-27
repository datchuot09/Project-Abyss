/**
 * Camera follow with map bounds. Pixel-perfect: the camera rounds its scroll
 * to whole pixels so tiles and sprites never shimmer.
 */
export class CameraController {
  constructor(scene, { bounds, target, lerp = 0.14, deadzone = { width: 24, height: 16 } }) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.camera.setRoundPixels(true);
    if (bounds) this.camera.setBounds(0, 0, bounds.width, bounds.height);
    if (target) this.follow(target, lerp, deadzone);
  }

  follow(target, lerp = 0.14, deadzone) {
    this.camera.startFollow(target, true, lerp, lerp);
    if (deadzone) this.camera.setDeadzone(deadzone.width, deadzone.height);
    this.camera.centerOn(target.x, target.y);
  }

  shake(durationMs = 120, intensity = 0.004) {
    this.camera.shake(durationMs, intensity);
  }
}
