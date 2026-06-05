import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts'],
    coverage: {
      include: ['packages/*/src/**/*.ts'],
      // worker.ts/main.ts are browser-runtime glue (Web Worker host + DOM wiring) that
      // cannot execute under Node/vitest; their logic lives in tested pure modules
      // (parse-files, chart, settings, core). They are covered by `vite build` + manual/
      // Playwright e2e (tracked TODO), so they are excluded from the unit-coverage gate.
      exclude: ['**/*.test.ts', '**/main.ts', '**/worker.ts'],
      thresholds: { statements: 80, functions: 80, lines: 80 },
    },
  },
});
