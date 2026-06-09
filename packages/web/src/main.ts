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

type ParseRequest =
  | { kind: 'files'; files: File[]; headerBytes: number }
  | { kind: 'urls'; urls: string[]; headerBytes: number };

function bindReRender(): void {
  for (const id of ['mode', 'buckets', 'lens', 'camera', 'threshold', 'topn']) {
    $(id).addEventListener('change', () => {
      if (lastPhotos.length > 0 || lastSkipped.length > 0) render(lastPhotos, lastSkipped);
    });
  }
}

function runWorker(payload: ParseRequest, count: number, noun: string): void {
  const status = document.getElementById('status')!;
  status.textContent = `读取 ${count} 个${noun}…`;

  currentWorker?.terminate();
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  currentWorker = worker;

  worker.onmessage = (e: MessageEvent) => {
    if (currentWorker !== worker) return; // ignore a superseded worker's queued messages
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
  worker.postMessage(payload);
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

$('picker').addEventListener('change', (ev) => {
  const files = Array.from((ev.target as HTMLInputElement).files ?? []);
  if (files.length === 0) return;
  runWorker({ kind: 'files', files, headerBytes: HEADER_BYTES }, files.length, '文件');
});

$('parse-urls').addEventListener('click', () => {
  const urls = $<HTMLTextAreaElement>('urls')
    .value.split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isHttpUrl);
  if (urls.length === 0) {
    document.getElementById('status')!.textContent = '没有有效的 http(s) 链接';
    return;
  }
  runWorker({ kind: 'urls', urls, headerBytes: HEADER_BYTES }, urls.length, '链接');
});

loadFormFromStorage();
bindReRender();
