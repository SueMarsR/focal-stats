import type { FocalStats } from '@focal-stats/core';
import { escHtml } from './utils';

const LABEL_WIDTH = 130; // px reserved for the left label column
const BAR_X = 70;        // x-origin of bars
const BAR_LABEL_GAP = 8; // gap between bar end and its value text

export function barChartSvg(stats: FocalStats, width = 600, barH = 28): string {
  const max = Math.max(1, ...stats.buckets.map((b) => b.count));
  const rows = stats.buckets
    .map((b, i) => {
      const w = Math.round((b.count / max) * (width - LABEL_WIDTH));
      const y = i * barH;
      return (
        `<text x="0" y="${y + barH / 2}" dominant-baseline="middle" font-size="12">${escHtml(b.label)}</text>` +
        `<rect x="${BAR_X}" y="${y + 4}" width="${w}" height="${barH - 8}" fill="#4f8cff" rx="3"/>` +
        `<text x="${BAR_X + BAR_LABEL_GAP + w}" y="${y + barH / 2}" dominant-baseline="middle" font-size="11" fill="#555">${b.percentage}% (${b.count})</text>`
      );
    })
    .join('');
  const h = Math.max(barH, stats.buckets.length * barH);
  return `<svg viewBox="0 0 ${width} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}
