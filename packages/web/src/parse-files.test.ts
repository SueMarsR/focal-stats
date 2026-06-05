import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFiles } from './parse-files';

const fixtureBytes = readFileSync(
  new URL('../../core/test/fixtures/sample.jpg', import.meta.url),
);

function makeFile(bytes: Uint8Array, name: string): File {
  return new File([new Uint8Array(bytes)], name);
}

describe('parseFiles', () => {
  it('解析含 EXIF 的文件并在末尾报告进度', async () => {
    const progress: number[] = [];
    const { photos, skipped } = await parseFiles(
      [makeFile(fixtureBytes, 'sample.jpg')],
      1024 * 1024,
      (p) => progress.push(p.done),
    );
    expect(photos).toHaveLength(1);
    expect(photos[0].focalLength35mm).toBe(52);
    expect(skipped).toHaveLength(0);
    expect(progress.at(-1)).toBe(1);
  });

  it('坏文件计入 skipped 且不抛错', async () => {
    const { photos, skipped } = await parseFiles(
      [makeFile(new Uint8Array([1, 2, 3]), 'bad.jpg')],
      1024 * 1024,
    );
    expect(photos).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].name).toBe('bad.jpg');
  });

  it('混合：好文件与坏文件分别归类', async () => {
    const { photos, skipped } = await parseFiles(
      [makeFile(fixtureBytes, 'good.jpg'), makeFile(new Uint8Array([0]), 'bad.jpg')],
      1024 * 1024,
    );
    expect(photos).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });
});
