import type { FocalStats, GroupStat } from '@focal-stats/core';
import { representativeFocal, detectBrand, detectBodyType } from '@focal-stats/core';
import { barChartSvg, type ChartColors } from './chart';
import { BRAND_ICONS, type IconGlyph } from './brand-icons';
import { BODY_GLYPHS } from './body-glyphs';
import { escHtml } from './utils';

// 4:5 portrait by default — best fit for 小红书 / Instagram feed. Height grows
// beyond BASE_H when the histogram is tall (many custom buckets) so nothing clips.
const W = 900;
const BASE_H = 1125;
const PAD = 64;

const BG = '#16181c';
const AMBER = '#e0a64d';
const TEXT = '#e7e7ea';
const MUTED = '#8a8d93';
const BORDER = '#2c3036';
// Single-quote multi-word family names: this string goes into a double-quoted SVG
// attribute (font-family="..."), and embedded double quotes would terminate the
// attribute → invalid XML → the card fails to load as an <img> for rasterization.
const SANS = "system-ui,-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif";
const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace';

const DEFAULT_URL = 'suemarsr.github.io/focal-stats';
const UNKNOWN = '未知';

const CHART_Y = 430;
const BAR_H = 44;
// The card is always dark and rasterized without a stylesheet, so the embedded chart
// must carry its own colors (the in-page chart's CSS classes don't apply here).
const CARD_CHART_COLORS: ChartColors = {
  label: '#cfd2d8',
  value: MUTED,
  track: '#23262c',
  bar: AMBER,
  barTop: '#f0b95e',
  font: MONO,
};
const ICON = 34; // device glyph box (square)
const LINE_H = 56; // device line vertical pitch (icons are taller than the text)
const DISCLAIMER = '品牌名称与标识为各自所有者的商标';

export interface ShareCardOpts {
  /** Branding URL shown in the footer. */
  url?: string;
}

/** Most-used real (non-"未知") group plus how many distinct real groups exist. */
function topReal(groups: GroupStat[]): { top: GroupStat; realCount: number } | null {
  const real = groups.filter((g) => g.key !== UNKNOWN);
  return real.length ? { top: real[0], realCount: real.length } : null;
}

/** Inline a single-path glyph as a nested <svg> — self-contained, no font, no remote ref. */
function iconMarkup(glyph: IconGlyph, x: number, y: number, size: number, fill: string): string {
  const fr = glyph.fillRule ? ` fill-rule="${glyph.fillRule}"` : '';
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${glyph.viewBox}"><path d="${glyph.path}" fill="${fill}"${fr}/></svg>`;
}

/**
 * Camera line: brand icon (or text wordmark when the brand has no bundled icon) +
 * a generic body-type glyph + the model text. Brand is identified from EXIF Make
 * (the reliable signal) so it works even when the model string omits the brand name.
 */
function cameraLine(top: GroupStat, realCount: number, y: number): string {
  const brand = detectBrand(top.make, top.key);
  const body = detectBodyType(top.make, top.key);
  const bodyGlyph = BODY_GLYPHS[body === 'unknown' ? 'camera' : body];
  const brandGlyph = brand ? BRAND_ICONS[brand.id] : undefined;
  const iconTop = y - 27;
  const parts: string[] = [];
  let x = PAD;
  if (brandGlyph) {
    parts.push(iconMarkup(brandGlyph, x, iconTop, ICON, TEXT));
    x += ICON + 12;
  }
  parts.push(iconMarkup(bodyGlyph, x, iconTop, ICON, MUTED));
  x += ICON + 16;
  // Prefix the wordmark only when there's no icon AND the model doesn't already name the brand.
  const needWordmark = !!brand && !brandGlyph && !top.key.toLowerCase().includes(brand.name.toLowerCase());
  const more = realCount > 1 ? ` 等 ${realCount} 台` : '';
  const label = (needWordmark ? `${brand!.name} ` : '') + top.key + more;
  parts.push(`<text x="${x}" y="${y}" font-size="30" fill="${TEXT}" font-family="${SANS}">${escHtml(label)}</text>`);
  return parts.join('');
}

/** Lens line: lens glyph + model text (no brand icon in v1 — lens EXIF strings are unreliable). */
function lensLine(top: GroupStat, realCount: number, y: number): string {
  const more = realCount > 1 ? ` 等 ${realCount} 支` : '';
  const x = PAD + ICON + 16;
  return (
    iconMarkup(BODY_GLYPHS.lens, PAD, y - 27, ICON, MUTED) +
    `<text x="${x}" y="${y}" font-size="30" fill="${TEXT}" font-family="${SANS}">${escHtml(top.key + more)}</text>`
  );
}

/**
 * Render a shareable "镜头画像" card as a standalone SVG string: hero focal length,
 * the focal-length histogram (reused from `barChartSvg`), the user's main camera body
 * + lens, and project branding. Pure and deterministic so it can be unit-tested; the
 * caller rasterizes it to PNG for download / the Web Share API.
 */
export function shareCardSvg(stats: FocalStats, opts: ShareCardOpts = {}): string {
  const url = opts.url ?? DEFAULT_URL;
  const modeLabel = stats.mode === 'equiv35' ? '35mm 等效' : '原始焦距';
  const rep = representativeFocal(stats);
  const heroFocal = rep ? rep.focal : 0;
  const heroPct = rep ? rep.percentage : 0;
  const heroCount = rep ? rep.count : 0;

  // Histogram embedded as a nested <svg> at full content width.
  const chartW = W - PAD * 2;
  const chartH = Math.max(BAR_H, stats.buckets.length * BAR_H);

  // Device block flows below the chart.
  const cam = topReal(stats.byCamera);
  const lens = topReal(stats.byLens);
  const deviceLines: string[] = [];
  let lineY = CHART_Y + chartH + 96;
  if (cam) {
    deviceLines.push(cameraLine(cam.top, cam.realCount, lineY));
    lineY += LINE_H;
  }
  if (lens) {
    deviceLines.push(lensLine(lens.top, lens.realCount, lineY));
    lineY += LINE_H;
  }
  const contentBottom = cam || lens ? lineY - LINE_H : CHART_Y + chartH;

  // Keep 4:5 for typical cards; grow so the footer/disclaimer never overlap a tall chart.
  const H = Math.max(BASE_H, contentBottom + 170);
  const footerRuleY = H - 120;
  const footerTextY = H - 74;
  // Trademark disclaimer — shown only when a device line is rendered (nominative use).
  const disclaimer = cam
    ? `<text x="${PAD}" y="${H - 36}" font-size="17" fill="${MUTED}" font-family="${SANS}">${DISCLAIMER}</text>`
    : '';

  return [
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="${W}" height="${H}" fill="${BG}"/>`,
    `<rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="20" fill="none" stroke="${BORDER}" stroke-width="2"/>`,

    // Header
    `<text x="${PAD}" y="100" font-size="26" letter-spacing="6" fill="${MUTED}" font-family="${SANS}" font-weight="600">FOCAL STATS · 焦段统计</text>`,
    `<rect x="${PAD}" y="120" width="72" height="4" rx="2" fill="${AMBER}"/>`,

    // Hero
    `<text class="hero-num" x="${PAD}" y="310" font-size="190" fill="${AMBER}" font-family="${MONO}" font-weight="700">${heroFocal}<tspan font-size="64" fill="${MUTED}" dx="6">mm</tspan></text>`,
    `<text x="${PAD}" y="372" font-size="30" fill="${MUTED}" font-family="${SANS}">最常用 · ${modeLabel} · ${heroPct}% · ${heroCount} 张</text>`,

    // Histogram (reuse barChartSvg, nested at content width)
    `<svg x="${PAD}" y="${CHART_Y}" width="${chartW}" height="${chartH}">${barChartSvg(stats, chartW, BAR_H, CARD_CHART_COLORS)}</svg>`,

    // Device block
    ...deviceLines,

    // Footer
    `<rect x="${PAD}" y="${footerRuleY}" width="${W - PAD * 2}" height="1.5" fill="${BORDER}"/>`,
    `<text x="${PAD}" y="${footerTextY}" font-size="26" fill="${MUTED}" font-family="${MONO}">${escHtml(url)}</text>`,
    `<text x="${W - PAD}" y="${footerTextY}" text-anchor="end" font-size="24" fill="${MUTED}" font-family="${SANS}">照片不离开你的设备</text>`,
    disclaimer,

    `</svg>`,
  ].join('');
}
