import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG } from '@focal-stats/core';
import type { PhotoExif } from '@focal-stats/core';
import { barChartSvg } from './chart';
import { serializeConfig, parseStoredConfig } from './settings';

const p = (f: number): PhotoExif => ({
  name: 'x', focalLength: f, focalLength35mm: f,
  lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
});

describe('barChartSvg', () => {
  it('生成 svg 且每桶一个 rect', () => {
    const stats = analyze([p(35), p(50)], DEFAULT_CONFIG);
    const svg = barChartSvg(stats);
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/class="bar"/g) ?? []).length).toBe(stats.buckets.length);
    expect((svg.match(/class="track"/g) ?? []).length).toBe(stats.buckets.length);
  });
});

describe('settings 序列化', () => {
  it('round-trip 配置', () => {
    const json = serializeConfig({ ...DEFAULT_CONFIG, topN: 7 });
    expect(parseStoredConfig(json).topN).toBe(7);
  });
  it('坏 JSON 回退默认配置', () => {
    expect(parseStoredConfig('{bad').mode).toBe('equiv35');
  });
});
