import type { FocalStats } from '@focal-stats/core';
import { escHtml } from './utils';

const LABEL_WIDTH = 130; // px reserved for the left label column + right value margin
const BAR_X = 70;        // x-origin of bars
const BAR_LABEL_GAP = 8; // gap between bar end and its value text
const TRACK_FILL = '#23262c';
const BAR_FILL = '#e0a64d';
const BAR_TOP_FILL = '#f0b95e'; // brighter amber for the most-used bucket
const LABEL_FILL = '#cfd2d8';
const VALUE_FILL = '#8a8d93';
const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace';

export function barChartSvg(stats: FocalStats, width = 600, barH = 30): string {
  const max = Math.max(1, ...stats.buckets.map((b) => b.count));
  const trackW = width - LABEL_WIDTH;
  const rows = stats.buckets
    .map((b, i) => {
      const w = Math.round((b.count / max) * trackW);
      const y = i * barH;
      const cy = y + barH / 2;
      const isTop = b.count === max && b.count > 0;
      return (
        `<text x="0" y="${cy}" dominant-baseline="middle" font-size="12" fill="${LABEL_FILL}" font-family="${MONO}">${escHtml(b.label)}</text>` +
        `<rect class="track" x="${BAR_X}" y="${y + 5}" width="${trackW}" height="${barH - 10}" rx="3" fill="${TRACK_FILL}"/>` +
        `<rect class="bar" x="${BAR_X}" y="${y + 5}" width="${w}" height="${barH - 10}" rx="3" fill="${isTop ? BAR_TOP_FILL : BAR_FILL}"/>` +
        `<text x="${BAR_X + BAR_LABEL_GAP + w}" y="${cy}" dominant-baseline="middle" font-size="11" fill="${VALUE_FILL}" font-family="${MONO}">${b.percentage}% (${b.count})</text>`
      );
    })
    .join('');
  const h = Math.max(barH, stats.buckets.length * barH);
  return `<svg viewBox="0 0 ${width} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}
