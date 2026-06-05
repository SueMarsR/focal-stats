import type { FocalStats } from '@focal-stats/core';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toJson(stats: FocalStats): string {
  return JSON.stringify(stats, null, 2);
}

export function toCsv(stats: FocalStats): string {
  const rows = ['focal,count,percentage'];
  for (const e of stats.exact) {
    const pct = stats.total === 0 ? 0 : Math.round((e.count / stats.total) * 1000) / 10;
    rows.push(`${e.focal},${e.count},${pct}`);
  }
  return rows.join('\n');
}

export function toHtml(stats: FocalStats): string {
  const bars = stats.buckets
    .map(
      (b) =>
        `<div class="row"><span class="lbl">${esc(b.label)}</span>` +
        `<span class="bar" style="width:${b.percentage}%"></span>` +
        `<span class="val">${b.percentage}% (${b.count})</span></div>`,
    )
    .join('');
  const insights = stats.insights.map((i) => `<li>${esc(i.message)}</li>`).join('');
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>焦段统计</title><style>
body{font-family:system-ui;max-width:720px;margin:2rem auto;padding:0 1rem}
.row{display:flex;align-items:center;gap:.5rem;margin:.25rem 0}
.lbl{width:84px;text-align:right;font-variant-numeric:tabular-nums}
.bar{height:1rem;background:#4f8cff;border-radius:3px;min-width:2px}
.val{font-size:.85rem;color:#555}</style></head><body>
<h1>焦段统计</h1>
<p>扫描 ${stats.scanned} 文件 · ${stats.total} 张含焦段 · 跳过 ${stats.skipped.length}</p>
${bars}<h2>洞察</h2><ul>${insights}</ul></body></html>`;
}
