import { describe, expect, it } from 'vitest';
import { generateInsights } from './insights';
import { DEFAULT_CONFIG } from './config';
import { aggregate } from './aggregate';
import type { PhotoExif } from './types';

function photo(focal: number): PhotoExif {
  return {
    name: 'x', focalLength: focal, focalLength35mm: focal,
    lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
  };
}

describe('generateInsights', () => {
  it('集中度高时给定焦建议', () => {
    const stats = aggregate(Array.from({ length: 10 }, () => photo(35)), DEFAULT_CONFIG);
    const ins = generateInsights(stats, DEFAULT_CONFIG);
    expect(ins.some((i) => i.type === 'most-used')).toBe(true);
    expect(ins.some((i) => i.type === 'prime-suggestion')).toBe(true);
  });

  it('分布分散时不给定焦建议', () => {
    const photos = [photo(16), photo(24), photo(50), photo(85), photo(135), photo(300)];
    const stats = aggregate(photos, DEFAULT_CONFIG);
    const ins = generateInsights(stats, DEFAULT_CONFIG);
    expect(ins.some((i) => i.type === 'prime-suggestion')).toBe(false);
    expect(ins.some((i) => i.type === 'concentration')).toBe(true);
  });

  it('空数据返回提示', () => {
    const stats = aggregate([], DEFAULT_CONFIG);
    const ins = generateInsights(stats, DEFAULT_CONFIG);
    expect(ins[0].message).toMatch(/未发现/);
  });

  it('equiv35 回退时产出 data-quality 提示', () => {
    const stats = aggregate(
      [{ name: 'x', focalLength: 35, focalLength35mm: null,
         lensModel: null, cameraMake: null, cameraModel: null, fNumber: null }],
      DEFAULT_CONFIG,
    );
    const ins = generateInsights(stats, DEFAULT_CONFIG);
    expect(ins.some((i) => i.type === 'data-quality')).toBe(true);
  });

  it('开放桶 200+ 定焦建议中点取下界', () => {
    const stats = aggregate(Array.from({ length: 5 }, () => photo(300)), DEFAULT_CONFIG);
    const ins = generateInsights(stats, DEFAULT_CONFIG);
    const prime = ins.find((i) => i.type === 'prime-suggestion');
    expect(prime).toBeDefined();
    expect(prime!.message).toContain('200+');
    expect(prime!.message).toContain('200mm');
  });
});
