import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG } from '@focal-stats/core';
import type { PhotoExif } from '@focal-stats/core';
import { shareCardSvg } from './share-card';

const photo = (over: Partial<PhotoExif>): PhotoExif => ({
  name: 'x',
  focalLength: 35,
  focalLength35mm: 35,
  lensModel: null,
  cameraMake: null,
  cameraModel: null,
  fNumber: null,
  ...over,
});

const SONY = { cameraMake: 'Sony', cameraModel: 'ILCE-7M4', lensModel: 'FE 24-70mm F2.8 GM' };

describe('shareCardSvg', () => {
  // focals 35,35,50 → top focal 35 at 66.7%
  const stats = analyze(
    [
      photo({ focalLength35mm: 35, ...SONY }),
      photo({ focalLength35mm: 35, ...SONY }),
      photo({ focalLength35mm: 50, ...SONY }),
    ],
    DEFAULT_CONFIG,
  );

  it('合法 svg，含品牌名与分享 URL', () => {
    const svg = shareCardSvg(stats);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('焦段统计');
    expect(svg).toContain('focal-stats');
  });

  it('含 hero 焦段、占比与模式标签', () => {
    const svg = shareCardSvg(stats);
    expect(svg).toContain('hero-num');
    expect(svg).toContain('66.7%'); // topFocal[0].percentage
    expect(svg).toContain('35mm 等效'); // mode label
  });

  it('内嵌直方图：每桶一个 bar', () => {
    const svg = shareCardSvg(stats);
    expect((svg.match(/class="bar"/g) ?? []).length).toBe(stats.buckets.length);
  });

  it('含主力机身与镜头', () => {
    const svg = shareCardSvg(stats);
    expect(svg).toContain('ILCE-7M4');
    expect(svg).toContain('FE 24-70mm F2.8 GM');
  });

  it('无可识别设备时省略设备行、不崩溃', () => {
    const noDev = analyze([photo({ focalLength35mm: 35 })], DEFAULT_CONFIG);
    const svg = shareCardSvg(noDev);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('📷');
    expect(svg).not.toContain('🔭');
    expect(svg).not.toContain('未知');
  });

  it('转义设备名中的 HTML 特殊字符', () => {
    const evil = analyze([photo({ focalLength35mm: 35, cameraModel: '<b>x</b>' })], DEFAULT_CONFIG);
    const svg = shareCardSvg(evil);
    expect(svg).not.toContain('<b>x</b>');
    expect(svg).toContain('&lt;b&gt;');
  });

  it('常规桶数为 4:5（高 1125）', () => {
    expect(shareCardSvg(stats)).toContain('height="1125"'); // 8 default buckets fit
  });

  it('桶很多时卡片高度自适应增长，页脚不被裁剪', () => {
    const manyBoundaries = Array.from({ length: 18 }, (_, i) => (i + 1) * 10); // → 19 buckets
    const tall = analyze(
      [photo({ focalLength35mm: 35, ...SONY })],
      { ...DEFAULT_CONFIG, bucketBoundaries: manyBoundaries },
    );
    const svg = shareCardSvg(tall);
    const h = Number(svg.match(/^<svg width="\d+" height="(\d+)"/)![1]);
    expect(h).toBeGreaterThan(1125);
    expect(svg).toContain('focal-stats'); // footer still present below the chart
  });

  it('多机身时标注「等 N 台」', () => {
    const multi = analyze(
      [
        photo({ focalLength35mm: 35, cameraModel: 'A7' }),
        photo({ focalLength35mm: 35, cameraModel: 'A7' }),
        photo({ focalLength35mm: 50, cameraModel: 'X100V' }),
      ],
      DEFAULT_CONFIG,
    );
    const svg = shareCardSvg(multi);
    expect(svg).toContain('A7'); // most-used body first
    expect(svg).toContain('等 2 台');
  });
});
