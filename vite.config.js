import { defineConfig } from 'vite';

// base: './' keeps asset URLs relative so the production build can be
// loaded from file:// inside Electron (Phase 12) and from Capacitor.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  }
});
