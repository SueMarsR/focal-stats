import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig, validateConfig } from './config';

describe('config', () => {
  it('默认配置合法', () => {
    expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
    expect(DEFAULT_CONFIG.mode).toBe('equiv35');
    expect(DEFAULT_CONFIG.topN).toBe(3);
  });
  it('parseConfig 合并 partial 到默认值', () => {
    const c = parseConfig({ topN: 5, filterLens: '24-70' });
    expect(c.topN).toBe(5);
    expect(c.filterLens).toBe('24-70');
    expect(c.mode).toBe('equiv35');
  });
  it('分桶边界非升序抛错', () => {
    expect(() => parseConfig({ bucketBoundaries: [24, 16] })).toThrow(/升序/);
  });
  it('primeThreshold 越界抛错', () => {
    expect(() => parseConfig({ primeThreshold: 1.5 })).toThrow(/primeThreshold/);
  });
  it('topN 非正整数抛错', () => {
    expect(() => parseConfig({ topN: 0 })).toThrow(/topN/);
  });
  it('零值边界抛错', () => {
    expect(() => parseConfig({ bucketBoundaries: [0, 24] })).toThrow(/正数/);
  });
  it('primeThreshold 为 NaN 抛错', () => {
    expect(() => parseConfig({ primeThreshold: NaN })).toThrow(/primeThreshold/);
  });
  it('分桶边界含 NaN 抛错', () => {
    expect(() => parseConfig({ bucketBoundaries: [16, NaN, 50] })).toThrow(/NaN/);
  });
});
