import { analyze, parseConfig } from '@focal-stats/core';
import type { AnalyzeConfig, PhotoExif, SkippedFile } from '@focal-stats/core';
import { barChartSvg } from './chart';
import { parseStoredConfig, serializeConfig } from './settings';

const HEADER_BYTES = 1024 * 1024;
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;

function readConfigFromForm(): AnalyzeConfig {
  return parseConfig({
    mode: $('mode').value as AnalyzeConfig['mode'],
    bucketBoundaries: $('buckets').value.split(',').map((s) => Number(s.trim())),
    filterLens: $('lens').value || null,
    filterCamera: $('camera').value || null,
    primeThreshold: Number($('threshold').value),
    topN: Number($('topn').value),
  });
}

function loadFormFromStorage(): void {
  const cfg = parseStoredConfig(localStorage.getItem('focal-stats-config') ?? '');
  $('mode').value = cfg.mode;
  $('buckets').value = cfg.bucketBoundaries.join(',');
  $('lens').value = cfg.filterLens ?? '';
  $('camera').value = cfg.filterCamera ?? '';
  $('threshold').value = String(cfg.primeThreshold);
  $('topn').value = String(cfg.topN);
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render(photos: PhotoExif[], skipped: SkippedFile[]): void {
  let config: AnalyzeConfig;
  try {
    config = readConfigFromForm();
  } catch (err) {
    document.getElementById('status')!.textContent =
      `配置错误：${err instanceof Error ? err.message : String(err)}`;
    return;
  }
  localStorage.setItem('focal-stats-config', serializeConfig(config));
  const stats = analyze(photos, config, skipped);
  document.getElementById('chart')!.innerHTML = barChartSvg(stats);
  document.getElementById('insights')!.innerHTML =
    '<h2>洞察</h2>' + stats.insights.map((i) => `<div class="card">${esc(i.message)}</div>`).join('');
}

let lastPhotos: PhotoExif[] = [];
let lastSkipped: SkippedFile[] = [];

function bindReRender(): void {
  for (const id of ['mode', 'buckets', 'lens', 'camera', 'threshold', 'topn']) {
    $(id).addEventListener('change', () => render(lastPhotos, lastSkipped));
  }
}

$('picker').addEventListener('change', async (ev) => {
  const files = Array.from((ev.target as HTMLInputElement).files ?? []);
  const status = document.getElementById('status')!;
  if (files.length === 0) return;
  status.textContent = `读取 ${files.length} 个文件…`;

  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const d = e.data;
    if (d.type === 'progress') status.textContent = `解析中 ${d.done}/${d.total}…`;
    else if (d.type === 'done') {
      lastPhotos = d.photos;
      lastSkipped = d.skipped;
      status.textContent = `完成：${d.photos.length} 张含焦段，跳过 ${d.skipped.length}`;
      render(lastPhotos, lastSkipped);
      worker.terminate();
    }
  };
  worker.postMessage({ files, headerBytes: HEADER_BYTES });
});

loadFormFromStorage();
bindReRender();
