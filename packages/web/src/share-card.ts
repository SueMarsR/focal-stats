import type { FocalStats, GroupStat } from '@focal-stats/core';
import { representativeFocal, detectBrand, detectBodyType } from '@focal-stats/core';
import { barChartSvg, type ChartColors } from './chart';
import { BRAND_ICONS, type IconGlyph } from './brand-icons';
import { BODY_GLYPHS } from './body-glyphs';
import { SITE_QR } from './qr-code';
import { escHtml } from './utils';

// 4:5 portrait by default — best fit for 小红书 / Instagram feed. Height grows
// beyond BASE_H when the histogram is tall (many custom buckets) so nothing clips.
const W = 900;
const BASE_H = 1125;
const PAD = 64;

// Single-quote multi-word family names: this string goes into a double-quoted SVG
// attribute (font-family="..."), and embedded double quotes would terminate the
// attribute → invalid XML → the card fails to load as an <img> for rasterization.
const SANS = "system-ui,-apple-system,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif";
const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace';

const DEFAULT_URL = 'suemarsr.github.io/focal-stats';
const UNKNOWN = '未知';

const CHART_Y = 430;
const BAR_H = 44;
const ICON = 34; // device glyph box (square)
const LINE_H = 56; // device line vertical pitch (icons are taller than the text)
const QR_SIZE = 140; // QR tile edge (top-right)

export type CardTheme = 'light' | 'dark';

/** Card colors, mirroring the web app's Apple light/dark design tokens. */
interface Palette {
  bg: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentBright: string;
  gradFrom: string;
  gradTo: string;
  track: string;
  chartLabel: string;
}

const PALETTES: Record<CardTheme, Palette> = {
  dark: {
    bg: '#1c1c1e',
    text: '#f5f5f7',
    muted: '#98989d',
    border: '#2c2c2e',
    accent: '#0a84ff',
    accentBright: '#64d2ff',
    gradFrom: '#0a84ff',
    gradTo: '#64d2ff',
    track: '#2c2c2e',
    chartLabel: '#cfd2d8',
  },
  light: {
    bg: '#ffffff',
    text: '#1d1d1f',
    muted: '#6e6e73',
    border: '#d2d2d7',
    accent: '#0071e3',
    accentBright: '#0a84ff',
    gradFrom: '#0071e3',
    gradTo: '#5e5ce6',
    track: '#e8e8ed',
    chartLabel: '#1d1d1f',
  },
};

export interface ShareCardOpts {
  /** Branding URL shown in the footer. */
  url?: string;
  /** Match the web app's current appearance; defaults to dark. */
  theme?: CardTheme;
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

function deviceText(label: string, x: number, y: number, p: Palette): string {
  return `<text x="${x}" y="${y}" font-size="30" fill="${p.text}" font-family="${SANS}">${escHtml(label)}</text>`;
}

/**
 * Scan-to-visit QR (top-right), pointing at the site. Always a white tile with dark
 * modules + quiet zone so it scans on either theme; bundled inline (self-contained).
 */
function qrMarkup(p: Palette): string {
  const s = QR_SIZE;
  const x = W - PAD - s;
  const y = 52;
  const scale = s / SITE_QR.modules;
  return (
    `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="14" fill="#ffffff" stroke="${p.border}" stroke-width="1"/>` +
    `<g transform="translate(${x},${y}) scale(${scale})"><path d="${SITE_QR.path}" stroke="#1c1c1e" stroke-width="1" shape-rendering="crispEdges"/></g>` +
    `<text x="${x + s / 2}" y="${y + s + 26}" text-anchor="middle" font-size="18" fill="${p.muted}" font-family="${SANS}">扫码访问</text>`
  );
}

/**
 * Camera line: brand icon (or text wordmark when the brand has no bundled icon) +
 * a generic body-type glyph + the model text. Brand is identified from EXIF Make
 * (the reliable signal) so it works even when the model string omits the brand name.
 */
function cameraLine(top: GroupStat, realCount: number, y: number, p: Palette): string {
  const brand = detectBrand(top.make, top.key);
  const body = detectBodyType(top.make, top.key);
  const bodyGlyph = BODY_GLYPHS[body === 'unknown' ? 'camera' : body];
  const brandGlyph = brand ? BRAND_ICONS[brand.id] : undefined;
  const iconTop = y - 27;
  const parts: string[] = [];
  let x = PAD;
  if (brandGlyph) {
    parts.push(iconMarkup(brandGlyph, x, iconTop, ICON, p.text));
    x += ICON + 12;
  }
  parts.push(iconMarkup(bodyGlyph, x, iconTop, ICON, p.muted));
  x += ICON + 16;
  // Prefix the wordmark only when there's no icon AND the model doesn't already name the brand.
  const needWordmark = !!brand && !brandGlyph && !top.key.toLowerCase().includes(brand.name.toLowerCase());
  const more = realCount > 1 ? ` 等 ${realCount} 台` : '';
  const label = (needWordmark ? `${brand!.name} ` : '') + top.key + more;
  parts.push(deviceText(label, x, y, p));
  return parts.join('');
}

/** Lens line: lens glyph + model text (no brand icon in v1 — lens EXIF strings are unreliable). */
function lensLine(top: GroupStat, realCount: number, y: number, p: Palette): string {
  const more = realCount > 1 ? ` 等 ${realCount} 支` : '';
  const x = PAD + ICON + 16;
  return iconMarkup(BODY_GLYPHS.lens, PAD, y - 27, ICON, p.muted) + deviceText(top.key + more, x, y, p);
}

/**
 * Render a shareable "镜头画像" card as a standalone SVG string: hero focal length,
 * the focal-length histogram (reused from `barChartSvg`), the user's main camera body
 * + lens, and project branding. Styled in the web app's Apple system-blue look, in
 * whichever light/dark theme the caller passes. Pure and deterministic (unit-tested);
 * the caller rasterizes it to PNG for download / the Web Share API.
 */
export function shareCardSvg(stats: FocalStats, opts: ShareCardOpts = {}): string {
  const url = opts.url ?? DEFAULT_URL;
  const p = PALETTES[opts.theme ?? 'dark'];
  const modeLabel = stats.mode === 'equiv35' ? '35mm 等效' : '原始焦距';
  const rep = representativeFocal(stats);
  const heroFocal = rep ? rep.focal : 0;
  const heroPct = rep ? rep.percentage : 0;
  const heroCount = rep ? rep.count : 0;

  // Embedded histogram carries its own (theme) colors — the rasterized card has no
  // stylesheet, so the in-page chart's CSS classes don't apply here.
  const chartColors: ChartColors = {
    label: p.chartLabel,
    value: p.muted,
    track: p.track,
    bar: p.accent,
    barTop: p.accentBright,
    font: MONO,
  };
  const chartW = W - PAD * 2;
  const chartH = Math.max(BAR_H, stats.buckets.length * BAR_H);

  // Device block flows below the chart.
  const cam = topReal(stats.byCamera);
  const lens = topReal(stats.byLens);
  const deviceLines: string[] = [];
  let lineY = CHART_Y + chartH + 96;
  if (cam) {
    deviceLines.push(cameraLine(cam.top, cam.realCount, lineY, p));
    lineY += LINE_H;
  }
  if (lens) {
    deviceLines.push(lensLine(lens.top, lens.realCount, lineY, p));
    lineY += LINE_H;
  }
  const contentBottom = cam || lens ? lineY - LINE_H : CHART_Y + chartH;

  // Keep 4:5 for typical cards; grow so the footer never overlaps a tall chart.
  const H = Math.max(BASE_H, contentBottom + 150);
  const footerRuleY = H - 110;
  const footerTextY = H - 64;

  return [
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="${W}" height="${H}" fill="${p.bg}"/>`,
    `<defs><linearGradient id="card-hero-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.gradFrom}"/><stop offset="1" stop-color="${p.gradTo}"/></linearGradient></defs>`,
    `<rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="20" fill="none" stroke="${p.border}" stroke-width="2"/>`,

    // Header
    `<text x="${PAD}" y="100" font-size="26" letter-spacing="6" fill="${p.muted}" font-family="${SANS}" font-weight="600">FOCAL STATS · 焦段统计</text>`,
    `<rect x="${PAD}" y="120" width="72" height="4" rx="2" fill="${p.accent}"/>`,

    // Scan-to-visit QR (top-right)
    qrMarkup(p),

    // Hero — number filled with the system-blue gradient
    `<text class="hero-num" x="${PAD}" y="310" font-size="190" fill="url(#card-hero-grad)" font-family="${MONO}" font-weight="700">${heroFocal}<tspan font-size="64" fill="${p.muted}" dx="6">mm</tspan></text>`,
    `<text x="${PAD}" y="372" font-size="30" fill="${p.muted}" font-family="${SANS}">最常用 · ${modeLabel} · ${heroPct}% · ${heroCount} 张</text>`,

    // Histogram (reuse barChartSvg, nested at content width)
    `<svg x="${PAD}" y="${CHART_Y}" width="${chartW}" height="${chartH}">${barChartSvg(stats, chartW, BAR_H, chartColors)}</svg>`,

    // Device block
    ...deviceLines,

    // Footer
    `<rect x="${PAD}" y="${footerRuleY}" width="${W - PAD * 2}" height="1.5" fill="${p.border}"/>`,
    `<text x="${PAD}" y="${footerTextY}" font-size="26" fill="${p.muted}" font-family="${MONO}">${escHtml(url)}</text>`,
    `<text x="${W - PAD}" y="${footerTextY}" text-anchor="end" font-size="24" fill="${p.muted}" font-family="${SANS}">照片不离开你的设备</text>`,

    `</svg>`,
  ].join('');
}
