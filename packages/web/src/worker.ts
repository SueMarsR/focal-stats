import { parseFiles } from './parse-files';
import { parseUrls } from './parse-urls';

type ParseRequest =
  | { kind: 'files'; files: File[]; headerBytes: number }
  | { kind: 'urls'; urls: string[]; headerBytes: number };

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const req = e.data;
  const onProgress = (p: { done: number; total: number }) =>
    postMessage({ type: 'progress', done: p.done, total: p.total });
  const { photos, skipped } =
    req.kind === 'files'
      ? await parseFiles(req.files, req.headerBytes, onProgress)
      : await parseUrls(req.urls, req.headerBytes, onProgress);
  postMessage({ type: 'done', photos, skipped });
};
