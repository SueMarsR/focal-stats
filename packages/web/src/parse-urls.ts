import { extractExif } from '@focal-stats/core';
import type { PhotoExif, SkippedFile } from '@focal-stats/core';
import { PROGRESS_INTERVAL } from './parse-files';
import type { ParseProgress, ParseResult } from './parse-files';

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<Response>;

/** Decoded last non-empty path segment of a URL; query/hash stripped. Falls back to the raw string. */
export function fileNameFromUrl(url: string): string {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : url;
  } catch {
    return url;
  }
}

/** Read at most `headerBytes` from a Response body, cancelling the rest so we never download a whole RAW. */
async function readCappedBody(res: Response, headerBytes: number): Promise<ArrayBuffer> {
  const body = res.body;
  if (!body) return (await res.arrayBuffer()).slice(0, headerBytes);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < headerBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
    }
  }
  await reader.cancel().catch(() => {});

  const out = new Uint8Array(Math.min(received, headerBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= out.byteLength) break;
    const take = Math.min(chunk.byteLength, out.byteLength - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return out.buffer;
}

/**
 * Fetch each URL's first `headerBytes` (where EXIF lives) and parse it with the same
 * `extractExif` used for local files. Never throws: network/CORS failures become
 * `fetch-error`, non-2xx become `http-error`. Reports progress every PROGRESS_INTERVAL
 * URLs and once at the end. `fetchFn` is injectable for testing.
 */
export async function parseUrls(
  urls: string[],
  headerBytes: number,
  onProgress?: (p: ParseProgress) => void,
  fetchFn: FetchLike = (input, init) => fetch(input, init),
): Promise<ParseResult> {
  const photos: PhotoExif[] = [];
  const skipped: SkippedFile[] = [];
  let done = 0;
  for (const url of urls) {
    const name = fileNameFromUrl(url);
    try {
      const res = await fetchFn(url, { headers: { Range: `bytes=0-${headerBytes - 1}` } });
      if (!res.ok) {
        skipped.push({ name, reason: 'http-error' });
      } else {
        const r = extractExif(await readCappedBody(res, headerBytes), name);
        if ('reason' in r) skipped.push(r);
        else photos.push(r);
      }
    } catch {
      skipped.push({ name, reason: 'fetch-error' });
    }
    done++;
    if (done % PROGRESS_INTERVAL === 0 || done === urls.length) {
      onProgress?.({ done, total: urls.length });
    }
  }
  return { photos, skipped };
}
