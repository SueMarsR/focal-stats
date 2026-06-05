import { extractExif } from '@focal-stats/core';
import type { PhotoExif, SkippedFile } from '@focal-stats/core';

export const PROGRESS_INTERVAL = 25;

export interface ParseProgress {
  done: number;
  total: number;
}

export interface ParseResult {
  photos: PhotoExif[];
  skipped: SkippedFile[];
}

/**
 * Parse a list of File/Blob objects by reading only the first `headerBytes`
 * of each (EXIF lives in the header). Never throws: unreadable/corrupt files
 * become SkippedFile entries. Reports progress every PROGRESS_INTERVAL files
 * and once at the end.
 */
export async function parseFiles(
  files: File[],
  headerBytes: number,
  onProgress?: (p: ParseProgress) => void,
): Promise<ParseResult> {
  const photos: PhotoExif[] = [];
  const skipped: SkippedFile[] = [];
  let done = 0;
  for (const file of files) {
    try {
      const buf = await file.slice(0, headerBytes).arrayBuffer();
      const r = extractExif(buf, file.name);
      if ('reason' in r) skipped.push(r);
      else photos.push(r);
    } catch {
      skipped.push({ name: file.name, reason: 'read-error' });
    }
    done++;
    if (done % PROGRESS_INTERVAL === 0 || done === files.length) {
      onProgress?.({ done, total: files.length });
    }
  }
  return { photos, skipped };
}
