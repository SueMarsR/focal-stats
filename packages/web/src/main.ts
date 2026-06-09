import { analyze, parseConfig } from '@focal-stats/core';
import type { AnalyzeConfig, PhotoExif, SkippedFile } from '@focal-stats/core';
import { barChartSvg } from './chart';
import { parseStoredConfig, serializeConfig } from './settings';
import { escHtml } from './utils';

const HEADER_BYTES = 1024 * 1024;
const $ = <T extends HTMLElement = HTMLInputElement>(id: string): T =>
  document.getElementById(id) as T;

function readConfigFromForm(): AnalyzeConfig {
  return parseConfig({
    mode: $<HTMLSelectElement>('mode').value as AnalyzeConfig['mode'],
    bucketBoundaries: $('buckets').value.split(',').map((s) => Number(s.trim())),
    filterLens: $('lens').value || null,
    filterCamera: $('camera').value || null,
    primeThreshold: Number($('threshold').value),
    topN: Number($('topn').value),
  });
}

function loadFormFromStorage(): void {
  const cfg = parseStoredConfig(localStorage.getItem('focal-stats-config') ?? '');
  $<HTMLSelectElement>('mode').value = cfg.mode;
  $('buckets').value = cfg.bucketBoundaries.join(',');
  $('lens').value = cfg.filterLens ?? '';
  $('camera').value = cfg.filterCamera ?? '';
  $('threshold').value = String(cfg.primeThreshold);
  $('topn').value = String(cfg.topN);
}

function render(photos: PhotoExif[], skipped: SkippedFile[]): void {
  const hero = document.getElementById('hero')!;
  let config: AnalyzeConfig;
  try {
    config = readConfigFromForm();
  } catch (err) {
    document.getElementById('status')!.textContent =
      `配置错误：${err instanceof Error ? err.message : String(err)}`;
    document.getElementById('chart')!.innerHTML = '';
    document.getElementById('insights')!.innerHTML = '';
    hero.innerHTML = '';
    hero.style.display = 'none';
    return;
  }
  localStorage.setItem('focal-stats-config', serializeConfig(config));
  const stats = analyze(photos, config, skipped);
  if (stats.total > 0 && stats.topFocal[0]) {
    const top = stats.topFocal[0];
    const modeLabel = stats.mode === 'equiv35' ? '35mm 等效' : '原始焦距';
    hero.innerHTML =
      `<div class="hero-num">${top.focal}<span class="hero-unit">mm</span></div>` +
      `<div class="hero-label">最常用焦段 · ${modeLabel} · ${top.percentage}% / ${top.count} 张</div>`;
    hero.style.display = '';
  } else {
    hero.innerHTML = '';
    hero.style.display = 'none';
  }
  document.getElementById('chart')!.innerHTML = barChartSvg(stats);
  document.getElementById('insights')!.innerHTML =
    '<h2 class="panel-title">洞察</h2>' + stats.insights.map((i) => `<div class="card">${escHtml(i.message)}</div>`).join('');
}

let lastPhotos: PhotoExif[] = [];
let lastSkipped: SkippedFile[] = [];
let currentWorker: Worker | null = null;

function bindReRender(): void {
  for (const id of ['mode', 'buckets', 'lens', 'camera', 'threshold', 'topn']) {
    $(id).addEventListener('change', () => {
      if (lastPhotos.length > 0 || lastSkipped.length > 0) render(lastPhotos, lastSkipped);
    });
  }
}

$('picker').addEventListener('change', async (ev) => {
  const files = Array.from((ev.target as HTMLInputElement).files ?? []);
  const status = document.getElementById('status')!;
  if (files.length === 0) return;
  status.textContent = `读取 ${files.length} 个文件…`;

  currentWorker?.terminate();
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  currentWorker = worker;

  worker.onmessage = (e: MessageEvent) => {
    const d = e.data;
    if (d.type === 'progress') {
      status.textContent = `解析中 ${d.done}/${d.total}…`;
    } else if (d.type === 'done') {
      lastPhotos = d.photos;
      lastSkipped = d.skipped;
      status.textContent = `完成：${d.photos.length} 张含焦段，跳过 ${d.skipped.length}`;
      render(lastPhotos, lastSkipped);
      worker.terminate();
      if (currentWorker === worker) currentWorker = null;
    }
  };
  worker.onerror = (errEvent) => {
    status.textContent = `解析出错：${errEvent.message ?? '未知错误'}`;
    worker.terminate();
    if (currentWorker === worker) currentWorker = null;
  };
  worker.postMessage({ files, headerBytes: HEADER_BYTES });
});

loadFormFromStorage();
bindReRender();
