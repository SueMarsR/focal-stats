import { describe, expect, it } from 'vitest';
import { parseCliArgs } from './args';

describe('parseCliArgs', () => {
  it('解析路径与默认值', () => {
    const o = parseCliArgs(['/Volumes/SD']);
    expect(o.path).toBe('/Volumes/SD');
    expect(o.format).toBe('text');
    expect(o.config.mode).toBe('equiv35');
    expect(o.headerBytes).toBe(1024 * 1024);
  });
  it('解析自定义分桶/筛选/阈值/格式', () => {
    const o = parseCliArgs([
      '/sd', '--buckets', '24,35,50', '--lens', '24-70',
      '--prime-threshold', '0.7', '--top', '5', '--json',
    ]);
    expect(o.config.bucketBoundaries).toEqual([24, 35, 50]);
    expect(o.config.filterLens).toBe('24-70');
    expect(o.config.primeThreshold).toBe(0.7);
    expect(o.config.topN).toBe(5);
    expect(o.format).toBe('json');
  });
  it('缺路径抛错', () => {
    expect(() => parseCliArgs([])).toThrow(/用法/);
  });
  it('--buckets 含非数字抛错', () => {
    expect(() => parseCliArgs(['/sd', '--buckets', '24,abc'])).toThrow(/非数字/);
  });
  it('--header-bytes 非正整数抛错', () => {
    expect(() => parseCliArgs(['/sd', '--header-bytes', 'abc'])).toThrow(/header-bytes/);
  });
});
