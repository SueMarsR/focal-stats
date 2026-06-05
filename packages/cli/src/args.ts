import { parseArgs } from 'node:util';
import { parseConfig } from '@focal-stats/core';
import type { AnalyzeConfig } from '@focal-stats/core';

export interface CliOptions {
  path: string;
  config: AnalyzeConfig;
  format: 'text' | 'json' | 'csv' | 'html';
  headerBytes: number;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      mode: { type: 'string' },
      buckets: { type: 'string' },
      lens: { type: 'string' },
      camera: { type: 'string' },
      'prime-threshold': { type: 'string' },
      top: { type: 'string' },
      'header-bytes': { type: 'string' },
      json: { type: 'boolean' },
      csv: { type: 'boolean' },
      html: { type: 'boolean' },
    },
  });

  const path = positionals[0];
  if (!path) throw new Error('用法: focal-stats <文件夹路径> [选项]');

  const partial: Partial<AnalyzeConfig> = {};
  if (values.mode) partial.mode = values.mode as AnalyzeConfig['mode'];
  if (values.buckets) {
    partial.bucketBoundaries = values.buckets.split(',').map((s) => {
      const n = Number(s.trim());
      if (Number.isNaN(n)) throw new Error(`--buckets 含非数字: ${s}`);
      return n;
    });
  }
  if (values.lens) partial.filterLens = values.lens;
  if (values.camera) partial.filterCamera = values.camera;
  if (values['prime-threshold']) partial.primeThreshold = Number(values['prime-threshold']);
  if (values.top) partial.topN = Number(values.top);

  const format = values.json ? 'json' : values.csv ? 'csv' : values.html ? 'html' : 'text';
  const headerBytes = values['header-bytes'] ? Number(values['header-bytes']) : 1024 * 1024;

  return { path, config: parseConfig(partial), format, headerBytes };
}
