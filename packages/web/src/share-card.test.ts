import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG } from '@focal-stats/core';
import type { PhotoExif } from '@focal-stats/core';
import { shareCardSvg } from './share-card';
import { BRAND_ICONS } from './brand-icons';
import { BODY_GLYPHS } from './body-glyphs';
import { SITE_QR } from './qr-code';

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

  it('是合法 XML（能作为 <img> 光栅化）：属性值内无裸双引号', () => {
    const svg = shareCardSvg(stats);
    // Strip every well-formed key="value" attribute (whose value has no "). A well-formed
    // SVG whose text holds no double-quote leaves none behind. A font stack with embedded
    // double quotes — the bug that broke the share image — leaks a stray " here.
    const leftover = svg.replace(/\s[\w:-]+="[^"]*"/g, '');
    expect(leftover).not.toContain('"');
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

  it('内嵌直方图用自包含内联颜色，随主题切换（光栅化时无 CSS）', () => {
    const dark = shareCardSvg(stats, { theme: 'dark' });
    expect(dark).toContain('fill="#2c2c2e"'); // dark track — chart-only color
    expect(dark).toContain('fill="#64d2ff"'); // dark top-bucket highlight
    const light = shareCardSvg(stats, { theme: 'light' });
    expect(light).toContain('fill="#e8e8ed"'); // light track
    expect(light).toContain('fill="#0071e3"'); // light system-blue bar
  });

  it('右上角含网页二维码（内联自包含，带扫码提示）', () => {
    const svg = shareCardSvg(stats);
    expect(svg).toContain(SITE_QR.path); // QR modules embedded inline (no remote ref)
    expect(svg).toContain('扫码访问');
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
    expect(svg).not.toContain(BODY_GLYPHS.camera.path);
    expect(svg).not.toContain(BODY_GLYPHS.lens.path);
    expect(svg).not.toContain('未知');
  });

  it('主力机身渲染品牌图标 + 机身类型图标 + 镜头图标（Sony 有图标）', () => {
    const svg = shareCardSvg(stats);
    expect(svg).toContain(BRAND_ICONS.sony!.path); // brand mark embedded inline
    expect(svg).toContain(BODY_GLYPHS.camera.path); // body-type glyph
    expect(svg).toContain(BODY_GLYPHS.lens.path); // lens line glyph
  });

  it('缺失图标的品牌（佳能）退化为文字，不嵌任何品牌图标', () => {
    const canon = analyze(
      [photo({ focalLength35mm: 35, cameraMake: 'Canon', cameraModel: 'Canon EOS R6' })],
      DEFAULT_CONFIG,
    );
    const svg = shareCardSvg(canon);
    expect(svg).toContain('Canon EOS R6');
    expect(Object.values(BRAND_ICONS).every((g) => !svg.includes(g.path))).toBe(true);
    expect(svg).toContain(BODY_GLYPHS.camera.path); // body glyph still shown
  });

  it('图标缺失且型号不含品牌名时，前置文字商标', () => {
    const sigma = analyze(
      [photo({ focalLength35mm: 45, cameraMake: 'SIGMA', cameraModel: 'fp' })],
      DEFAULT_CONFIG,
    );
    expect(shareCardSvg(sigma)).toContain('Sigma fp'); // wordmark prefix
  });

  it('手机型号渲染手机图标', () => {
    const phone = analyze(
      [photo({ focalLength35mm: 26, cameraMake: 'Apple', cameraModel: 'iPhone 15 Pro' })],
      DEFAULT_CONFIG,
    );
    const svg = shareCardSvg(phone);
    expect(svg).toContain(BRAND_ICONS.apple!.path);
    expect(svg).toContain(BODY_GLYPHS.phone.path);
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
