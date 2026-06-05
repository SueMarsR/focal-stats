import type { FocalStats } from '@focal-stats/core';

function bar(percentage: number, width = 30): string {
  const filled = Math.round((percentage / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

export function renderText(stats: FocalStats): string {
  const unit = stats.mode === 'equiv35' ? 'mm(等效)' : 'mm';
  const lines: string[] = [];
  lines.push(`扫描 ${stats.scanned} 文件 · ${stats.total} 张含焦段 · 跳过 ${stats.skipped.length}`);
  if (stats.total === 0) {
    lines.push('', '洞察:');
    for (const i of stats.insights) lines.push(`  • ${i.message}`);
    return lines.join('\n');
  }
  lines.push('', `焦段分布（${unit}）:`);
  for (const b of stats.buckets) {
    lines.push(`  ${b.label.padStart(8)} | ${bar(b.percentage)} ${b.percentage}% (${b.count})`);
  }
  lines.push('', 'Top 焦段:');
  for (const t of stats.topFocal) {
    lines.push(`  ${String(t.focal).padStart(4)}${unit}: ${t.count} 张 (${t.percentage}%)`);
  }
  lines.push('', '洞察:');
  for (const i of stats.insights) lines.push(`  • ${i.message}`);
  return lines.join('\n');
}
