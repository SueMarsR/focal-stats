import { describe, expect, it } from 'vitest';
import { aggregate } from './aggregate';
import { DEFAULT_CONFIG } from './config';
import { representativeFocal } from './representative';
import type { PhotoExif } from './types';

const photo = (focal: number): PhotoExif => ({
  name: 'x',
  focalLength: focal,
  focalLength35mm: focal,
  lensModel: null,
  cameraMake: null,
  cameraModel: null,
  fNumber: null,
});

describe('representativeFocal', () => {
  it('取「占比最高的桶」内出现最多的精确焦距，而非全局最多重复的焦距', () => {
    // 24mm 重复最多（2 张），但照片主要落在 100–200 区间（4 张）。
    const focals = [24, 24, 40, 55, 60, 65, 80, 90, 110, 135, 150, 180];
    const stats = aggregate(focals.map(photo), DEFAULT_CONFIG);
    const rep = representativeFocal(stats);
    expect(rep).not.toBeNull();
    expect(rep!.focal).toBe(110); // 100–200 桶内最靠前的精确焦距，而不是全局的 24mm
    expect(rep!.count).toBe(4); // 该桶张数
    expect(rep!.bucketLabel).toContain('100');
    expect(rep!.bucketLabel).toContain('200');
    expect(rep!.percentage).toBeGreaterThan(33);
  });

  it('定焦党：代表焦距就是那个焦距', () => {
    const stats = aggregate(Array.from({ length: 10 }, () => photo(35)), DEFAULT_CONFIG);
    expect(representativeFocal(stats)!.focal).toBe(35);
  });

  it('无数据时返回 null', () => {
    expect(representativeFocal(aggregate([], DEFAULT_CONFIG))).toBeNull();
  });
});
