import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG } from '@focal-stats/core';
import { SAMPLE_PHOTOS } from './sample-data';

describe('SAMPLE_PHOTOS (landing-page demo dataset)', () => {
  it('是一组足够大的、可分析的照片', () => {
    expect(SAMPLE_PHOTOS.length).toBeGreaterThan(100);
  });

  it('analyze 一定产出有意义的结果（演示永远能渲染）', () => {
    const stats = analyze(SAMPLE_PHOTOS, DEFAULT_CONFIG);
    expect(stats.total).toBe(SAMPLE_PHOTOS.length);
    expect(stats.topFocal[0].focal).toBe(35); // 讲一个「35mm 选手」的故事
  });

  it('含真实设备信息（机身 + 至少两支镜头），让示例卡片也展示设备', () => {
    const stats = analyze(SAMPLE_PHOTOS, DEFAULT_CONFIG);
    expect(stats.byCamera.every((c) => c.key !== '未知')).toBe(true);
    expect(stats.byCamera[0].key).toBe('ILCE-7M4');
    expect(stats.byLens.filter((l) => l.key !== '未知').length).toBeGreaterThanOrEqual(2);
  });
});
