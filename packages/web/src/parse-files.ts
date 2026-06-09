import { extractExif } from '@focal-stats/core';
import type { PhotoExif, SkippedFile } from '@focal-stats/core';

export const PROGRESS_INTERVAL = 25;
// Most JPEG EXIF lives in the first ~128KB; read that first and only fetch more
// (up to headerBytes) when no focal length is found (e.g. some HEIC layouts).
const SMALL_HEADER = 128 * 1024;
// Overlap the I/O-bound header reads. extractExif is sync on the worker thread,
// but reads (file.slice().arrayBuffer()) overlap, cutting wall-time for big batches.
const CONCURRENCY = 8;

export interface ParseProgress {
  done: number;
  total: number;
}

export interface ParseResult {
  photos: PhotoExif[];
  skipped: SkippedFile[];
}

/**
 * Parse one file: read a small header first; if no focal length is found, read up
 * to `headerBytes` and retry. Results are identical to a single full-header read —
 * only the bytes read differ (JPEGs with early EXIF skip the large read).
 * Never throws (read failures become a read-error SkippedFile).
 */
async function parseOne(file: File, headerBytes: number): Promise<PhotoExif | SkippedFile> {
  const firstN = Math.min(SMALL_HEADER, headerBytes);
  try {
    const small = extractExif(await file.slice(0, firstN).arrayBuffer(), file.name);
    if (!('reason' in small) && (small.focalLength != null || small.focalLength35mm != null)) {
      return small; // focal already present in the small header — no need to read more
    }
    if (firstN < headerBytes) {
      return extractExif(await file.slice(0, headerBytes).arrayBuffer(), file.name);
    }
    return small;
  } catch {
    return { name: file.name, reason: 'read-error' };
  }
}

/**
 * Parse File/Blob objects with bounded concurrency (overlapping header reads).
 * Order of results is not significant (the caller aggregates). Reports progress
 * every PROGRESS_INTERVAL completions and once at the end.
 */
export async function parseFiles(
  files: File[],
  headerBytes: number,
  onProgress?: (p: ParseProgress) => void,
): Promise<ParseResult> {
  const photos: PhotoExif[] = [];
  const skipped: SkippedFile[] = [];
  const total = files.length;
  let done = 0;
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= total) return;
      const r = await parseOne(files[i], headerBytes);
      if ('reason' in r) skipped.push(r);
      else photos.push(r);
      done++;
      if (done % PROGRESS_INTERVAL === 0 || done === total) {
        onProgress?.({ done, total });
      }
    }
  }

  const n = Math.min(CONCURRENCY, Math.max(1, total));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return { photos, skipped };
}
