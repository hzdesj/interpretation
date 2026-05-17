import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Interpretation-Web/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 3000,
  },
});
