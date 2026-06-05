import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from './index.js';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../core/test/fixtures',
);

describe('cli run (e2e)', () => {
  it('对夹具目录输出 JSON 含焦段', async () => {
    const out = await run([fixturesDir, '--json']);
    const stats = JSON.parse(out);
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.topFocal[0].focal).toBe(52); // equiv35 默认
  });

  it('text 模式含洞察', async () => {
    const out = await run([fixturesDir]);
    expect(out).toMatch(/最常用焦段/);
  });
});
