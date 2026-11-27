// Tiny service locator for game-wide singletons created in main.js
// (settings, display). Scenes read from here instead of importing main.js,
// which keeps the dependency graph acyclic.
export const services = {
  settings: null,
  display: null
};
