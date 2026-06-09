# Web URL Input + AGPL-3.0 License Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the static web app parse photos from pasted **direct URLs** (header-only, no backend), and adopt **AGPL-3.0 + a trademark notice**.

**Architecture:** A new tested pure module `parse-urls.ts` mirrors `parse-files.ts`, fetching only the first ~1 MB of each URL (Range + capped stream read) and reusing `core.extractExif`. The Web Worker gains a discriminated-union message (`files` | `urls`); `main.ts` keeps a single `runWorker` helper used by both the folder picker and a new URL textarea. License work is mechanical: copy the AGPL `LICENSE`, set SPDX in `package.json`s, add a README notice, and make the existing footer mention AGPL source.

**Tech Stack:** TypeScript, Vite, Vitest, Web Workers, `exifreader` (via `@focal-stats/core`).

Spec: `docs/superpowers/specs/2026-06-09-web-url-input-and-agpl-license-design.md`

---

## File structure

- **Create** `packages/web/src/parse-urls.ts` — pure URL→EXIF parser (network injected). Tested; counts toward coverage gate.
- **Create** `packages/web/src/parse-urls.test.ts` — unit tests, fake `fetchFn` from the `sample.jpg` fixture.
- **Modify** `packages/core/src/types.ts` — extend `SkippedFile.reason` union.
- **Modify** `packages/web/src/worker.ts` — discriminated-union request, route to `parseFiles`/`parseUrls`.
- **Modify** `packages/web/src/main.ts` — extract `runWorker`, add `isHttpUrl`, wire `#parse-urls`.
- **Modify** `packages/web/index.html` — URL input section + AGPL footer text + CSS.
- **Create** `LICENSE` — verbatim AGPL-3.0 (copied from the user's existing file).
- **Modify** `package.json`, `packages/{core,cli,web}/package.json` — add `"license": "AGPL-3.0-only"`.
- **Modify** `README.md` — 许可/商标 notice.

---

## Task 1: `parse-urls.ts` — fetch & parse EXIF from direct URLs (TDD)

**Files:**
- Create: `packages/web/src/parse-urls.ts`
- Create: `packages/web/src/parse-urls.test.ts`
- Modify: `packages/core/src/types.ts:13`

- [ ] **Step 1: Extend the `SkippedFile.reason` union** (prerequisite for the tests to type-check)

In `packages/core/src/types.ts`, replace the `reason` line (line 13):

```ts
  reason: 'no-exif' | 'no-focal-length' | 'parse-error' | 'read-error' | 'fetch-error' | 'http-error';
```

- [ ] **Step 2: Write the failing test file**

Create `packages/web/src/parse-urls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseUrls, fileNameFromUrl, type FetchLike } from './parse-urls';

const fixtureBytes = new Uint8Array(
  readFileSync(new URL('../../core/test/fixtures/sample.jpg', import.meta.url)),
);

describe('fileNameFromUrl', () => {
  it('取末段并解码、去掉查询串', () => {
    expect(fileNameFromUrl('https://h/a/b/DSCF%201234.RAF?x=1#z')).toBe('DSCF 1234.RAF');
  });
  it('无路径段时回退为整串', () => {
    expect(fileNameFromUrl('not a url')).toBe('not a url');
  });
});

describe('parseUrls', () => {
  it('200 直链 → 解析出 1 张并在末尾报告进度', async () => {
    const fetchFn: FetchLike = async () => new Response(fixtureBytes, { status: 200 });
    const progress: number[] = [];
    const { photos, skipped } = await parseUrls(
      ['https://h/sample.jpg'], 1024 * 1024, (p) => progress.push(p.done), fetchFn,
    );
    expect(photos).toHaveLength(1);
    expect(photos[0].focalLength35mm).toBe(52);
    expect(skipped).toHaveLength(0);
    expect(progress.at(-1)).toBe(1);
  });

  it('206 部分响应 → 同样解析', async () => {
    const fetchFn: FetchLike = async () => new Response(fixtureBytes, { status: 206 });
    const { photos } = await parseUrls(['https://h/p.jpg'], 1024 * 1024, undefined, fetchFn);
    expect(photos).toHaveLength(1);
  });

  it('网络/CORS 抛错 → skipped fetch-error，不抛出', async () => {
    const fetchFn: FetchLike = async () => { throw new TypeError('Failed to fetch'); };
    const { photos, skipped } = await parseUrls(['https://h/x.jpg'], 1024 * 1024, undefined, fetchFn);
    expect(photos).toHaveLength(0);
    expect(skipped).toEqual([{ name: 'x.jpg', reason: 'fetch-error' }]);
  });

  it('非 2xx → skipped http-error', async () => {
    const fetchFn: FetchLike = async () => new Response(null, { status: 404 });
    const { skipped } = await parseUrls(['https://h/missing.jpg'], 1024 * 1024, undefined, fetchFn);
    expect(skipped).toEqual([{ name: 'missing.jpg', reason: 'http-error' }]);
  });

  it('好坏混合分别归类', async () => {
    const fetchFn: FetchLike = async (u) =>
      u.includes('good') ? new Response(fixtureBytes, { status: 200 }) : new Response(null, { status: 404 });
    const { photos, skipped } = await parseUrls(
      ['https://h/good.jpg', 'https://h/bad.jpg'], 1024 * 1024, undefined, fetchFn,
    );
    expect(photos).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });

  it('响应大于 headerBytes → 只读 headerBytes 并取消下载', async () => {
    let cancelled = false;
    const big = new Uint8Array(10000).fill(7);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < big.length; i += 1000) controller.enqueue(big.subarray(i, i + 1000));
        controller.close();
      },
      cancel() { cancelled = true; },
    });
    const fetchFn: FetchLike = async () => new Response(stream, { status: 200 });
    const { skipped } = await parseUrls(['https://h/big.bin'], 1500, undefined, fetchFn);
    expect(cancelled).toBe(true);
    expect(skipped).toHaveLength(1); // 0x07 bytes aren't valid EXIF
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run packages/web/src/parse-urls.test.ts`
Expected: FAIL — cannot resolve `./parse-urls` (module not created yet).

- [ ] **Step 4: Write the implementation**

Create `packages/web/src/parse-urls.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run packages/web/src/parse-urls.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Run full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all green (66 prior + new tests; no type errors).

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/parse-urls.ts packages/web/src/parse-urls.test.ts packages/core/src/types.ts
git commit -m "feat(web): parseUrls — header-only EXIF parse from direct URLs"
```

---

## Task 2: Wire worker + main + UI

**Files:**
- Modify: `packages/web/src/worker.ts` (whole file)
- Modify: `packages/web/src/main.ts:65-109`
- Modify: `packages/web/index.html` (after line 96; CSS in `<style>`)

> No unit test: `worker.ts`/`main.ts` are excluded from the coverage gate (browser glue). Verified by `npm run typecheck` + `npm run build:web` + manual smoke.

- [ ] **Step 1: Replace `worker.ts` entirely**

```ts
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
```

- [ ] **Step 2: Replace `main.ts` lines 65–109** (from `let lastPhotos` to end of file) with:

```ts
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
```

- [ ] **Step 3: Add the URL input section to `index.html`** (immediately after the `</label>` closing the dropzone, currently line 96):

```html
    <div class="url-input">
      <label class="url-label" for="urls">或粘贴照片直链（每行一个）</label>
      <textarea id="urls" rows="3" placeholder="https://example.com/DSCF1234.jpg" aria-label="照片直链，每行一个"></textarea>
      <button id="parse-urls" type="button">解析链接</button>
      <p class="url-hint">直链需允许跨域（CORS）；百度网盘 / iCloud 等分享链接通常无法直接读取。</p>
    </div>
```

- [ ] **Step 4: Add CSS** for the section, inside the `<style>` block (before `</style>` at line 82):

```css
      .url-input { margin: 0 0 1.5rem; }
      .url-label { display: block; font-size: .85rem; color: var(--muted); margin-bottom: .4rem; }
      #urls {
        width: 100%; background: var(--panel); color: var(--text);
        border: 1px solid var(--border); border-radius: 8px; padding: .6rem .7rem;
        font-family: inherit; font-size: .85rem; resize: vertical;
      }
      #urls:focus { outline: none; border-color: var(--amber); }
      #parse-urls {
        margin-top: .5rem; background: var(--amber); color: var(--bg); border: none;
        border-radius: 8px; padding: .5rem 1rem; font-weight: 600; cursor: pointer;
      }
      #parse-urls:hover { background: var(--amber-hi); }
      .url-hint { font-size: .75rem; color: var(--muted); margin: .5rem 0 0; }
```

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build:web`
Expected: both succeed; `packages/web/dist/` regenerated with a `worker-*.js` chunk.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/worker.ts packages/web/src/main.ts packages/web/index.html
git commit -m "feat(web): URL input UI wired to worker (files | urls)"
```

---

## Task 3: AGPL-3.0 license + trademark notice

**Files:**
- Create: `LICENSE`
- Modify: `package.json`, `packages/core/package.json`, `packages/cli/package.json`, `packages/web/package.json`
- Modify: `README.md`, `packages/web/index.html:118-120`

- [ ] **Step 1: Add the AGPL-3.0 `LICENSE`** — copy the verbatim file the user already placed in the main checkout (do not retype legal text):

```bash
cp ../../../LICENSE ./LICENSE
head -1 LICENSE   # expect: "                    GNU AFFERO GENERAL PUBLIC LICENSE"
wc -l LICENSE     # expect: 662
```

(`../../../LICENSE` = repo root from `.claude/worktrees/url-input/`. If absent, fetch the canonical text from `https://www.gnu.org/licenses/agpl-3.0.txt` instead — never hand-author it.)

- [ ] **Step 2: Add SPDX `license` field** to all four `package.json` files. Add the line `"license": "AGPL-3.0-only",` after the `"version"` line (root has no version — add after `"name"`). Resulting key in each:

```json
  "license": "AGPL-3.0-only",
```

Files: `package.json` (root), `packages/core/package.json`, `packages/cli/package.json`, `packages/web/package.json`.

- [ ] **Step 3: Append the 许可 notice to `README.md`** (after the existing content):

```markdown

## 许可 · License

代码以 **AGPL-3.0** 授权（见 [LICENSE](./LICENSE)）：欢迎自由使用、修改、自建部署。但任何衍生版本——**包括作为网络服务运行的修改版（AGPL §13）**——都必须以 AGPL-3.0 同样开源。

项目名称 **「焦段统计 / Focal-Stats」及其图标不在代码许可范围内**。你可以 fork 和改造，但若以修改版对外发布，请使用你自己的名称，不要让人误以为是本项目的官方版本。
```

- [ ] **Step 4: Make the existing footer mention AGPL source** in `index.html` (line 119). Replace the footer inner text with:

```html
      开源于 <a href="https://github.com/SueMarsR/focal-stats" target="_blank" rel="noopener">GitHub</a> · 源代码以 AGPL-3.0 授权 · 照片不上传，本地解析
```

- [ ] **Step 5: Verify build still works** (HTML changed):

Run: `npm run build:web`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add LICENSE package.json packages/core/package.json packages/cli/package.json packages/web/package.json README.md packages/web/index.html
git commit -m "chore: adopt AGPL-3.0 license + trademark/source notice"
```

---

## Final verification (not a code task)

- [ ] `npm test` → all pass, coverage ≥80% (parse-urls covered).
- [ ] `npm run typecheck` → clean.
- [ ] `npm run build:web` → success.
- [ ] Adversarial multi-agent review (correctness / security / CORS+stream edge cases / AGPL §13 / coverage). Address findings.

---

## Self-review

**Spec coverage:**
- A.parse-urls (Range+cap, never-throw, reasons, progress, filename) → Task 1 ✅
- A.type extension → Task 1 Step 1 ✅
- A.worker union + main `runWorker` + `isHttpUrl` + honest CORS hint → Task 2 ✅
- B.LICENSE + SPDX + README notice + §13 footer → Task 3 ✅
- Gates (test/typecheck/build/coverage) + review → Final verification ✅

**Placeholder scan:** none — every code step shows full content; the only "if absent" branch (LICENSE fetch) is a concrete fallback, not a TODO.

**Type consistency:** `ParseRequest` union identical in `worker.ts` and `main.ts`; `FetchLike`/`ParseProgress`/`ParseResult` reused from `parse-urls`/`parse-files`; `reason` values `'fetch-error'`/`'http-error'` defined in Task 1 Step 1 and used in Task 1 Step 4 and the tests. Consistent.
