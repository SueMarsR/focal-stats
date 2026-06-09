import { analyze, parseConfig, representativeFocal } from '@focal-stats/core';
import type { AnalyzeConfig, FocalStats, PhotoExif, SkippedFile } from '@focal-stats/core';
import { barChartSvg } from './chart';
import { parseStoredConfig, serializeConfig } from './settings';
import { SAMPLE_PHOTOS } from './sample-data';
import { shareCardSvg } from './share-card';
import { escHtml } from './utils';

const HEADER_BYTES = 1024 * 1024;
const $ = <T extends HTMLElement = HTMLInputElement>(id: string): T =>
  document.getElementById(id) as T;

let lastStats: FocalStats | null = null;

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
    lastStats = null;
    document.getElementById('share-row')!.style.display = 'none';
    return;
  }
  localStorage.setItem('focal-stats-config', serializeConfig(config));
  const stats = analyze(photos, config, skipped);
  lastStats = stats;
  document.getElementById('share-row')!.style.display = stats.total > 0 ? '' : 'none';
  const rep = representativeFocal(stats);
  if (stats.total > 0 && rep) {
    const modeLabel = stats.mode === 'equiv35' ? '35mm 等效' : '原始焦距';
    hero.innerHTML =
      `<div class="hero-num">${rep.focal}<span class="hero-unit">mm</span></div>` +
      `<div class="hero-label">最常用焦段 · ${modeLabel} · ${rep.percentage}% / ${rep.count} 张</div>`;
    hero.style.display = '';
  } else {
    hero.innerHTML = '';
    hero.style.display = 'none';
  }
  document.getElementById('chart')!.innerHTML = barChartSvg(stats);
  document.getElementById('insights')!.innerHTML =
    '<h2 class="panel-title">洞察</h2>' + stats.insights.map((i) => `<div class="card">${escHtml(i.message)}</div>`).join('');
  const noFocal = stats.skipped.filter(
    (s) => s.reason === 'no-focal-length' || s.reason === 'no-exif',
  ).length;
  document.getElementById('status')!.textContent =
    `完成：${stats.total} 张含焦段，已跳过 ${stats.skipped.length} 张` +
    (noFocal > 0 ? `（其中 ${noFocal} 张无焦段/截图，未计入统计）` : '');
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

/** Rasterize an SVG string to a PNG Blob at `scale`× for a crisp share image. */
function svgToPng(svg: string, w: number, h: number, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出 PNG 失败'))), 'image/png');
    };
    img.onerror = () => reject(new Error('卡片渲染失败'));
    // UTF-8 data URL, NOT a blob: URL — iOS Safari (WebKit) fails to load an SVG
    // served from a blob into <img> for canvas rasterization (works in Chrome).
    // encodeURIComponent, NOT btoa: the card has non-Latin1 text (Chinese labels).
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function downloadBlob(blob: Blob, name: string): void {
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = name;
  a.click();
  URL.revokeObjectURL(objUrl);
}

/** Build the share card PNG and offer it via the native share sheet, else download. */
async function shareCard(): Promise<void> {
  if (!lastStats || lastStats.total === 0) return;
  const note = document.querySelector<HTMLElement>('#share-row .share-hint');

  // Rasterize at the card's own intrinsic size (height is dynamic), so a tall card
  // (many buckets) is never clipped and the dimensions can't drift from the SVG.
  let blob: Blob;
  try {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const svg = shareCardSvg(lastStats, { theme: dark ? 'dark' : 'light' });
    const dims = svg.match(/^<svg width="(\d+)" height="(\d+)"/);
    blob = await svgToPng(svg, dims ? Number(dims[1]) : 900, dims ? Number(dims[2]) : 1125);
  } catch (err) {
    if (note) note.textContent = `生成卡片失败：${err instanceof Error ? err.message : String(err)}`;
    return;
  }

  const file = new File([blob], 'focal-stats.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: '我的焦段画像', text: '我的焦段画像 · Focal-Stats' });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user dismissed the sheet
      // any other share failure → fall through to download rather than losing the card
    }
  }
  downloadBlob(blob, 'focal-stats.png');
}

function onPickFiles(ev: Event): void {
  const files = Array.from((ev.target as HTMLInputElement).files ?? []);
  if (files.length === 0) return;
  runWorker({ kind: 'files', files, headerBytes: HEADER_BYTES }, files.length, '文件');
}
$('btn-folder').addEventListener('click', () => $('picker-folder').click());
$('btn-photos').addEventListener('click', () => $('picker-photos').click());
$('picker-folder').addEventListener('change', onPickFiles);
$('picker-photos').addEventListener('change', onPickFiles);

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

$('share-card').addEventListener('click', shareCard);

/** Load the bundled sample library so a first-time visitor sees results instantly. */
function loadDemo(): void {
  currentWorker?.terminate(); // a mid-flight parse must not overwrite the demo later
  currentWorker = null;
  lastPhotos = SAMPLE_PHOTOS;
  lastSkipped = [];
  document.getElementById('status')!.textContent =
    `已加载示例数据（演示，共 ${SAMPLE_PHOTOS.length} 张）— 换成你自己的照片试试`;
  render(SAMPLE_PHOTOS, []);
}
$('demo').addEventListener('click', loadDemo);

loadFormFromStorage();
bindReRender();
