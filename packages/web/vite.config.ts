import { defineConfig } from 'vite';

export default defineConfig({
  root: 'packages/web',
  base: process.env.PAGES_BASE ?? '/focal-stats/',
  build: { outDir: 'dist', emptyOutDir: true },
});
