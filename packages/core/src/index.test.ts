import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG } from './index';
import type { PhotoExif, SkippedFile } from './index';

const p = (focal: number): PhotoExif => ({
  name: 'x', focalLength: focal, focalLength35mm: focal,
  lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
});

describe('analyze', () => {
  it('合并提取期跳过文件并产出洞察', () => {
    const pre: SkippedFile[] = [{ name: 'broken.cr2', reason: 'parse-error' }];
    const stats = analyze([p(35), p(35)], DEFAULT_CONFIG, pre);
    expect(stats.total).toBe(2);
    expect(stats.scanned).toBe(3);
    expect(stats.skipped).toEqual([{ name: 'broken.cr2', reason: 'parse-error' }]);
    expect(stats.insights.length).toBeGreaterThan(0);
  });
});
