import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { analyze, extractExif } from '@focal-stats/core';
import type { PhotoExif, SkippedFile } from '@focal-stats/core';
import { parseCliArgs } from './args.js';
import { listPhotoFiles, readHeader } from './scan.js';
import { mapPool } from './pool.js';
import { renderText } from './render.js';
import { toCsv, toHtml, toJson } from './export.js';

export async function run(argv: string[]): Promise<string> {
  const opts = parseCliArgs(argv);
  const files = await listPhotoFiles(opts.path);
  const photos: PhotoExif[] = [];
  const skipped: SkippedFile[] = [];

  const CONCURRENCY = 8; // parallel file-read workers; I/O-bound, not CPU-bound
  const results = await mapPool(files, CONCURRENCY, async (file) => {
    try {
      return extractExif(await readHeader(file, opts.headerBytes), file);
    } catch {
      return { name: file, reason: 'read-error' as const };
    }
  });
  for (const r of results) {
    if ('reason' in r) skipped.push(r);
    else photos.push(r);
  }

  const stats = analyze(photos, opts.config, skipped);
  if (opts.format === 'json') return toJson(stats);
  if (opts.format === 'csv') return toCsv(stats);
  if (opts.format === 'html') return toHtml(stats);
  return renderText(stats);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);

if (invokedDirectly) {
  run(process.argv.slice(2))
    .then((out) => process.stdout.write(out + '\n'))
    .catch((err) => {
      console.error(`错误: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
