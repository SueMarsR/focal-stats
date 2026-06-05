import { extractExif } from '@focal-stats/core';
import type { PhotoExif, SkippedFile } from '@focal-stats/core';

interface ParseRequest { files: File[]; headerBytes: number }

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { files, headerBytes } = e.data;
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
    if (done % 25 === 0 || done === files.length) {
      postMessage({ type: 'progress', done, total: files.length });
    }
  }
  postMessage({ type: 'done', photos, skipped });
};
