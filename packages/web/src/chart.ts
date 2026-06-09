import type { FocalStats } from '@focal-stats/core';
import { escHtml } from './utils';

const BAR_X = 70;             // x-origin of bars (left label column is 0..BAR_X)
const VALUE_COL_WIDTH = 100;  // px reserved on the right for the "100% (count)" text
const BAR_LABEL_GAP = 8;      // gap between bar end and its value text

// Colors are theme-aware and driven by CSS (#chart .lbl/.val/.track/.bar, and
// .bar[data-top] for the most-used bucket) so the chart adapts to light/dark.
export function barChartSvg(stats: FocalStats, width = 600, barH = 30): string {
  const max = Math.max(1, ...stats.buckets.map((b) => b.count));
  const trackW = width - BAR_X - VALUE_COL_WIDTH;
  const rows = stats.buckets
    .map((b, i) => {
      const w = Math.round((b.count / max) * trackW);
      const y = i * barH;
      const cy = y + barH / 2;
      const isTop = b.count === max && b.count > 0;
      return (
        `<text class="lbl" x="0" y="${cy}" dominant-baseline="middle" font-size="12">${escHtml(b.label)}</text>` +
        `<rect class="track" x="${BAR_X}" y="${y + 5}" width="${trackW}" height="${barH - 10}" rx="4"/>` +
        `<rect class="bar"${isTop ? ' data-top="1"' : ''} x="${BAR_X}" y="${y + 5}" width="${w}" height="${barH - 10}" rx="4"/>` +
        `<text class="val" x="${BAR_X + BAR_LABEL_GAP + w}" y="${cy}" dominant-baseline="middle" font-size="11">${b.percentage}% (${b.count})</text>`
      );
    })
    .join('');
  const h = Math.max(barH, stats.buckets.length * barH);
  return `<svg viewBox="0 0 ${width} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}
