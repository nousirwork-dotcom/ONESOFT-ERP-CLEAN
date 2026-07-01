import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'ui',
  base: './',
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'core'),
      '@ui': resolve(__dirname, 'ui'),
    },
  },
  build: {
    outDir: '../dist-ui',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
