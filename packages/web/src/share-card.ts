import type { FocalStats, GroupStat } from '@focal-stats/core';
import { representativeFocal } from '@focal-stats/core';
import { barChartSvg } from './chart';
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

export interface ShareCardOpts {
  /** Branding URL shown in the footer. */
  url?: string;
}

/** Most-used real (non-"未知") group plus how many distinct real groups exist. */
function topReal(groups: GroupStat[]): { key: string; count: number } | null {
  const real = groups.filter((g) => g.key !== UNKNOWN);
  return real.length ? { key: real[0].key, count: real.length } : null;
}

function deviceLine(icon: string, picked: { key: string; count: number }, unit: string, y: number): string {
  const more = picked.count > 1 ? ` 等 ${picked.count} ${unit}` : '';
  return `<text x="${PAD}" y="${y}" font-size="30" fill="${TEXT}" font-family="${SANS}">${icon} ${escHtml(picked.key)}${more}</text>`;
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
  let lineY = CHART_Y + chartH + 90;
  if (cam) {
    deviceLines.push(deviceLine('📷', cam, '台', lineY));
    lineY += 48;
  }
  if (lens) {
    deviceLines.push(deviceLine('🔭', lens, '支', lineY));
    lineY += 48;
  }
  const contentBottom = cam || lens ? lineY - 48 : CHART_Y + chartH;

  // Keep 4:5 for typical cards; grow so the footer never overlaps a tall chart.
  const H = Math.max(BASE_H, contentBottom + 130);
  const footerRuleY = H - 110;
  const footerTextY = H - 64;

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
    `<svg x="${PAD}" y="${CHART_Y}" width="${chartW}" height="${chartH}">${barChartSvg(stats, chartW, BAR_H)}</svg>`,

    // Device block
    ...deviceLines,

    // Footer
    `<rect x="${PAD}" y="${footerRuleY}" width="${W - PAD * 2}" height="1.5" fill="${BORDER}"/>`,
    `<text x="${PAD}" y="${footerTextY}" font-size="26" fill="${MUTED}" font-family="${MONO}">${escHtml(url)}</text>`,
    `<text x="${W - PAD}" y="${footerTextY}" text-anchor="end" font-size="24" fill="${MUTED}" font-family="${SANS}">照片不离开你的设备</text>`,

    `</svg>`,
  ].join('');
}
