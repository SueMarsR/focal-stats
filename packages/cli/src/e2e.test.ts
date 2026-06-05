import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { run } from './index.js';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../core/test/fixtures',
);

describe('cli run (e2e)', () => {
  it('对夹具目录输出 JSON 含焦段', async () => {
    const out = await run([fixturesDir, '--json']);
    const stats = JSON.parse(out);
    expect(stats.total).toBe(1);
    expect(stats.topFocal).not.toHaveLength(0);
    expect(stats.topFocal[0].focal).toBe(52); // equiv35 默认
  });

  it('text 模式含洞察', async () => {
    const out = await run([fixturesDir]);
    expect(out).toMatch(/最常用焦段/);
  });

  it('损坏文件被跳过且不影响整体', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fs-cli-e2e-'));
    try {
      await copyFile(join(fixturesDir, 'sample.jpg'), join(dir, 'good.jpg'));
      await writeFile(join(dir, 'bad.jpg'), ''); // 0-byte, no EXIF
      const out = await run([dir, '--json']);
      const stats = JSON.parse(out);
      expect(stats.total).toBe(1);
      expect(stats.skipped.length).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
