import type { AnalyzeConfig, FocalStats, Insight } from './types';
import { representativeFocal } from './representative';

export function generateInsights(
  stats: Omit<FocalStats, 'insights'>,
  config: AnalyzeConfig,
): Insight[] {
  if (stats.total === 0) {
    return [{ type: 'most-used', message: '未发现任何含焦段信息的照片。' }];
  }

  const insights: Insight[] = [];
  const unit = stats.mode === 'equiv35' ? 'mm 等效' : 'mm';
  // Headline = the busiest bucket's most-common exact focal (a single number that sits
  // on the histogram's peak), not the globally most-repeated focal which is noise for zoom.
  const rep = representativeFocal(stats)!; // total > 0 above ⇒ at least one non-empty bucket
  insights.push({
    type: 'most-used',
    message: `最常用焦段：${rep.focal}${unit}（最集中区间 ${rep.bucketLabel}，占 ${rep.percentage}% / ${rep.count} 张）。`,
    data: { focal: rep.focal, count: rep.count, percentage: rep.percentage },
  });

  const topBucket = [...stats.buckets].sort((a, b) => b.count - a.count)[0];
  if (topBucket && topBucket.percentage / 100 >= config.primeThreshold) {
    // For the open-ended top bucket (e.g. "200+"), the midpoint is undefined;
    // we use its lower bound as a reasonable prime entry-point suggestion.
    const mid =
      topBucket.max === Infinity
        ? topBucket.min
        : Math.round((topBucket.min + topBucket.max) / 2);
    insights.push({
      type: 'prime-suggestion',
      message: `${topBucket.percentage}% 的照片落在 ${topBucket.label}${unit} 区间 → 适合一支约 ${mid}mm 定焦。`,
      data: { bucket: topBucket.label, percentage: topBucket.percentage },
    });
  } else {
    insights.push({
      type: 'concentration',
      message: `焦段分布较分散（最高单桶 ${topBucket?.percentage ?? 0}%，低于阈值 ${Math.round(
        config.primeThreshold * 100,
      )}%）→ 变焦更适合你。`,
    });
  }

  if (stats.equivFallbackCount > 0) {
    insights.push({
      type: 'data-quality',
      message: `注意：${stats.equivFallbackCount} 张照片无 35mm 等效信息，已按原始焦距计入。`,
    });
  }

  return insights;
}
