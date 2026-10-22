import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works under a GitHub Pages sub-path.
  base: './',
  // The engine spawns workers via new URL('./x-worker.js', import.meta.url);
  // pre-bundling would move the module and break those URLs.
  optimizeDeps: { exclude: ['@viggle/splat-engine'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  worker: { format: 'es' },
});
