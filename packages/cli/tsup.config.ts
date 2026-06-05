import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'packages/cli/src/index.ts' },
  outDir: 'packages/cli/dist',
  format: ['esm'],
  target: 'node20',
  noExternal: ['@focal-stats/core', 'exifreader'],
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
});
