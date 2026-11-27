import { computeScale } from '../core/PixelScaler.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/constants.js';
import { EventBus } from '../core/EventBus.js';
import { Events } from '../core/Events.js';

/**
 * Owns window sizing: integer (pixel-perfect) scaling with letterbox,
 * fractional "fit" fallback, fullscreen and window resize handling.
 * The canvas always renders at 480x270; only its CSS zoom changes.
 */
export class DisplayManager {
  constructor(game, settings) {
    this.game = game;
    this.settings = settings;
    this.state = null;
    this._raf = 0;
    this._onResize = () => {
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this.apply());
    };
    this._onFullscreen = () => {
      this.apply();
      EventBus.emit(Events.FULLSCREEN_CHANGED, this.isFullscreen);
    };
  }

  init() {
    window.addEventListener('resize', this._onResize);
    document.addEventListener('fullscreenchange', this._onFullscreen);
    window.visualViewport?.addEventListener('resize', this._onResize);
    this.apply();
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('fullscreenchange', this._onFullscreen);
    window.visualViewport?.removeEventListener('resize', this._onResize);
  }

  get root() {
    return document.getElementById('game-root');
  }

  get scaleMode() {
    return this.settings.get('video.scaleMode') === 'fit' ? 'fit' : 'integer';
  }

  get isFullscreen() {
    return Boolean(document.fullscreenElement);
  }

  apply() {
    const root = this.root;
    const state = computeScale({
      viewportWidth: root?.clientWidth || window.innerWidth,
      viewportHeight: root?.clientHeight || window.innerHeight,
      baseWidth: GAME_WIDTH,
      baseHeight: GAME_HEIGHT,
      devicePixelRatio: window.devicePixelRatio || 1,
      mode: this.scaleMode
    });
    this.state = { ...state, mode: this.scaleMode, fullscreen: this.isFullscreen };
    this.game.scale.setZoom(state.zoom);
    EventBus.emit(Events.DISPLAY_CHANGED, this.state);
    return this.state;
  }

  setScaleMode(mode) {
    this.settings.set('video.scaleMode', mode === 'fit' ? 'fit' : 'integer');
    return this.apply();
  }

  toggleScaleMode() {
    return this.setScaleMode(this.scaleMode === 'integer' ? 'fit' : 'integer');
  }

  /**
   * Must be called from inside a user gesture handler (pointerup / key down
   * event). Resolves to the new fullscreen state; never throws.
   */
  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (this.root?.requestFullscreen) {
        await this.root.requestFullscreen({ navigationUI: 'hide' });
      } else {
        return false;
      }
    } catch (err) {
      console.warn('[Display] Fullscreen request rejected:', err?.message ?? err);
    }
    return this.isFullscreen;
  }
}
