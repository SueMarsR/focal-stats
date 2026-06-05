import { describe, expect, it } from 'vitest';
import { aggregate } from './aggregate';
import { DEFAULT_CONFIG } from './config';
import type { PhotoExif } from './types';

function photo(p: Partial<PhotoExif>): PhotoExif {
  return {
    name: 'x', focalLength: null, focalLength35mm: null,
    lensModel: null, cameraMake: null, cameraModel: null, fNumber: null, ...p,
  };
}

describe('aggregate', () => {
  const photos = [
    photo({ name: '1', focalLength35mm: 35, lensModel: 'A', cameraModel: 'C1' }),
    photo({ name: '2', focalLength35mm: 35, lensModel: 'A', cameraModel: 'C1' }),
    photo({ name: '3', focalLength35mm: 50, lensModel: 'B', cameraModel: 'C2' }),
    photo({ name: '4', focalLength: null, focalLength35mm: null }),
  ];

  it('统计 total 与跳过', () => {
    const s = aggregate(photos, DEFAULT_CONFIG);
    expect(s.total).toBe(3);
    expect(s.skipped).toEqual([{ name: '4', reason: 'no-focal-length' }]);
    expect(s.scanned).toBe(4);
  });

  it('topFocal 降序且带百分比', () => {
    const s = aggregate(photos, DEFAULT_CONFIG);
    expect(s.topFocal[0]).toEqual({ focal: 35, count: 2, percentage: 66.7 });
  });

  it('按镜头分组', () => {
    const s = aggregate(photos, DEFAULT_CONFIG);
    expect(s.byLens).toEqual([
      { key: 'A', count: 2, topFocal: 35 },
      { key: 'B', count: 1, topFocal: 50 },
    ]);
  });

  it('filterLens 子串筛选', () => {
    const s = aggregate(photos, { ...DEFAULT_CONFIG, filterLens: 'a' });
    expect(s.total).toBe(2);
  });

  it('equiv35 缺失计入 equivFallbackCount', () => {
    const p = [photo({ name: '1', focalLength: 35, focalLength35mm: null })];
    const s = aggregate(p, DEFAULT_CONFIG);
    expect(s.equivFallbackCount).toBe(1);
    expect(s.total).toBe(1);
  });

  it('按机身分组', () => {
    const s = aggregate(photos, DEFAULT_CONFIG);
    expect(s.byCamera).toEqual([
      { key: 'C1', count: 2, topFocal: 35 },
      { key: 'C2', count: 1, topFocal: 50 },
    ]);
  });

  it('镜头为 null 归入未知组', () => {
    const p = [photo({ name: '1', focalLength35mm: 35, lensModel: null })];
    const s = aggregate(p, DEFAULT_CONFIG);
    expect(s.byLens).toEqual([{ key: '未知', count: 1, topFocal: 35 }]);
  });

  it('分组计数相同时按 key 字典序排序', () => {
    const p = [
      photo({ focalLength35mm: 35, lensModel: 'Zeta' }),
      photo({ focalLength35mm: 50, lensModel: 'Alpha' }),
    ];
    const s = aggregate(p, DEFAULT_CONFIG);
    expect(s.byLens.map((g) => g.key)).toEqual(['Alpha', 'Zeta']);
  });
});
