import type { FocalStats } from '@focal-stats/core';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function barChartSvg(stats: FocalStats, width = 600, barH = 28): string {
  const max = Math.max(1, ...stats.buckets.map((b) => b.count));
  const rows = stats.buckets
    .map((b, i) => {
      const w = Math.round((b.count / max) * (width - 130));
      const y = i * barH;
      return (
        `<text x="0" y="${y + barH / 2}" dominant-baseline="middle" font-size="12">${esc(b.label)}</text>` +
        `<rect x="70" y="${y + 4}" width="${w}" height="${barH - 8}" fill="#4f8cff" rx="3"/>` +
        `<text x="${78 + w}" y="${y + barH / 2}" dominant-baseline="middle" font-size="11" fill="#555">${b.percentage}% (${b.count})</text>`
      );
    })
    .join('');
  const h = Math.max(barH, stats.buckets.length * barH);
  return `<svg viewBox="0 0 ${width} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}
