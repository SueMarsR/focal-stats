import { parseFiles } from './parse-files';

interface ParseRequest {
  files: File[];
  headerBytes: number;
}

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { files, headerBytes } = e.data;
  const { photos, skipped } = await parseFiles(files, headerBytes, (p) =>
    postMessage({ type: 'progress', done: p.done, total: p.total }),
  );
  postMessage({ type: 'done', photos, skipped });
};
