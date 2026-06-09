# Spec — Web URL input + AGPL-3.0 license (2026-06-09)

Source: `TODO.md` (2026/06/09). Two **independent** deliverables shipped on one
branch (`worktree-url-input`, base `9bd8d98` = v0.2.0), as two separated commits.

## Context & invariants

`focal-stats/web` is a **100% client-side, static** GitHub Pages app. Its core
promise (README) is *照片不上传 · 照片不离开浏览器*: a folder picker yields `File`
objects, a Web Worker reads only the first ~1 MB (EXIF header) of each via
`core.extractExif`, nothing is sent to any server.

Both deliverables MUST preserve: no backend, no build-time secrets, the
header-only read discipline, and the existing `{ photos, skipped }` →
`render()` pipeline.

Pipeline today:
- `main.ts` `#picker` change → spawn worker, post `{ files, headerBytes }`.
- `worker.ts` → `parseFiles(files, headerBytes, onProgress)` → post
  `{type:'progress'}` / `{type:'done', photos, skipped}`.
- `parse-files.ts` `parseFiles(files, headerBytes, onProgress)`: loop, read
  `file.slice(0, headerBytes).arrayBuffer()`, `extractExif(buf, name)`, never
  throws (bad file → `SkippedFile`), progress every `PROGRESS_INTERVAL` and at end.
- `core.extractExif(buffer: ArrayBuffer, name: string): PhotoExif | SkippedFile`.

Coverage gate (`vitest.config.ts`): `include: packages/*/src/**/*.ts`,
`exclude: main.ts, worker.ts, *.test.ts`, thresholds 80% stmts/fns/lines.
→ New logic lives in a **tested pure module**; worker/main stay thin glue.

---

## Deliverable A — `feat(web)`: parse photos from pasted direct URLs

### Goal / non-goals
- **Goal:** user pastes one or more **direct file URLs** (one per line); the app
  fetches only the ~1 MB header of each and feeds it through the *same*
  `extractExif`, merging into the same `{ photos, skipped }` render path.
- **Non-goals (explicit):** No OAuth, no provider SDKs, no backend/proxy. 百度网盘 /
  iCloud share links and OneDrive auth flows are **out of scope** (infeasible from a
  static page; see TODO discussion). URLs only work if the host allows CORS.

### New module — `packages/web/src/parse-urls.ts`
Pure, network-injected, mirrors `parse-files.ts`. Reuses `PROGRESS_INTERVAL`,
`ParseProgress`, `ParseResult` exported from `parse-files.ts` (DRY — no duplication).

```ts
export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<Response>;

export async function parseUrls(
  urls: string[],
  headerBytes: number,
  onProgress?: (p: ParseProgress) => void,
  fetchFn?: FetchLike,            // defaults to globalThis.fetch; injected in tests
): Promise<ParseResult>;
```

Behaviour per URL (never throws; failures → `SkippedFile`):
1. `fetchFn(url, { headers: { Range: \`bytes=0-${headerBytes - 1}\` } })`.
2. If `!res.ok` (status outside 200–299) → `{ name, reason: 'http-error' }`.
3. Else read a **capped** body (≤ `headerBytes`) via `readCappedBody` →
   `extractExif(buf, name)`; `'reason' in r ? skipped : photos`.
4. Any thrown error (network / CORS / TypeError / no body) →
   `{ name, reason: 'fetch-error' }`.
5. `name` derived by `fileNameFromUrl(url)`: decoded last non-empty path segment,
   query/hash stripped; fall back to the full URL if no segment.
6. Progress every `PROGRESS_INTERVAL` and once at end (identical cadence to
   `parseFiles`).

`readCappedBody(res, headerBytes)`: stream `res.body.getReader()`, accumulate
chunks until `received >= headerBytes`, then `reader.cancel()` to stop the
download, concat, slice to `headerBytes`, return `ArrayBuffer`. This caps the
transfer at ~1 MB whether the server honours `Range` (`206`) **or** ignores it
(`200`) — preserving the "never read the whole RAW" guarantee. If `res.body` is
null, fall back to `await res.arrayBuffer()` then slice.

### Core type change — `packages/core/src/types.ts`
Extend `SkippedFile.reason` union:
```ts
reason: 'no-exif' | 'no-focal-length' | 'parse-error' | 'read-error'
      | 'fetch-error' | 'http-error';
```
Safe: only `'reason' in r` discrimination exists in the codebase (no exhaustive
`switch` over `reason`). No other change to `core`.

### Worker protocol — `packages/web/src/worker.ts`
Evolve the request to a discriminated union; one worker, switch on `kind`:
```ts
type ParseRequest =
  | { kind: 'files'; files: File[]; headerBytes: number }
  | { kind: 'urls';  urls: string[]; headerBytes: number };
```
`kind:'files'` → `parseFiles(...)`; `kind:'urls'` → `parseUrls(...)`. Response
messages (`progress` / `done`) unchanged. `render()` untouched.

### UI / wiring — `index.html` + `main.ts`
- `index.html`: below the dropzone, a URL section styled with the existing dark-UI
  CSS vars — `<label>`, `<textarea id="urls" rows="3">` (one URL per line),
  `<button id="parse-urls" type="button">解析链接</button>`, and an **honest hint**:
  *直链需允许跨域（CORS）；百度网盘 / iCloud 等分享链接通常无法直接读取。*
- `main.ts`:
  - Extract the worker spawn/teardown into one helper
    `runWorker(payload: ParseRequest, fileCountLabel: number)` — used by **both**
    the picker and the URL button (refactor justified by the second caller; DRY).
  - `#picker` handler → `runWorker({ kind:'files', files, headerBytes }, files.length)`.
  - `#parse-urls` handler → split textarea on newlines, trim, drop blanks,
    **boundary-validate** each is `http(s)` via `isHttpUrl(s)` (`new URL` + protocol
    check). If none valid → status message, no worker. Else
    `runWorker({ kind:'urls', urls, headerBytes }, urls.length)`.

### Tests — `packages/web/src/parse-urls.test.ts` (TDD, must keep ≥80%)
Injected fake `fetchFn` built from the existing `core/test/fixtures/sample.jpg`
(no real network). Cases:
- ✅ `200` full body → 1 photo, `focalLength35mm === 52`; progress ends at total.
- ✅ `206` partial body → parsed identically.
- ✅ body **larger** than `headerBytes` (custom `ReadableStream` with a `cancel`
  spy) → only ~`headerBytes` consumed **and** `cancel` called (proves the download
  is capped).
- ✅ `fetchFn` throws `TypeError` → `skipped: [{ reason: 'fetch-error' }]`, no throw.
- ✅ `res.ok === false` (404) → `skipped: [{ reason: 'http-error' }]`.
- ✅ mixed good + bad URLs → split correctly into photos/skipped.
- ✅ `fileNameFromUrl`: `.../DSCF1234.RAF?x=1` → `DSCF1234.RAF`; segmentless URL →
  full URL.

---

## Deliverable B — `chore`: AGPL-3.0 + trademark notice

- **`LICENSE`** (repo root): verbatim official **GNU AGPL-3.0** text. Reuse the exact
  file the user already placed in `main`'s working tree (canonical 662-line FSF
  text) — copy it into the branch; do not hand-reproduce legal text.
- **SPDX** `"license": "AGPL-3.0-only"` in root + all three package `package.json`
  (`core`, `cli`, `web`).
- **README 商标/署名 notice** (short, honest): code is AGPL-3.0 — forks must stay
  open under AGPL, including network/SaaS use (§13); the **name "焦段统计 /
  Focal-Stats" and any logo are not licensed** — redistribute modified versions
  under a *different* name. Framing: deters closed repackaging, does not make
  forking impossible (no overstated legal force).
- **AGPL §13 gesture:** a small `源代码 · Source (AGPL-3.0)` footer link in the web UI
  → the GitHub repo, so network users can reach the source.
- **Non-goal:** per-file GPL headers (heavy for a small project; the LICENSE +
  README notice + footer link suffice for this scope).

---

## Process & acceptance

- One branch `worktree-url-input`; two commits: `feat(web): parse photos from
  pasted direct URLs` then `chore: adopt AGPL-3.0 license + trademark notice`.
- TDD for A (RED → GREEN → refactor). B is mechanical.
- After implementation, run an **adversarial multi-agent review** (correctness /
  security / CORS+stream edge cases / AGPL §13 / coverage) before reporting done.
- **Gates (all must pass):** `npm test`, `npm run typecheck`, `npm run build:web`;
  coverage ≥80% maintained.

### Acceptance criteria
1. Pasting a CORS-enabled direct image URL renders the same histogram/insights as
   the local picker, reading ≤ ~1 MB per file.
2. Unreachable / CORS-blocked / 404 / non-image URLs become `skipped` entries with
   `fetch-error` / `http-error`; the app never throws and still renders.
3. Local folder picker path is unchanged and still passes its tests.
4. `LICENSE` (AGPL-3.0) present; SPDX set in all `package.json`; README notice +
   footer source link present.
5. All gates green.

### Coordination note
The user has an **untracked AGPL `LICENSE`** in `main`'s working tree. This branch
adds an identical `LICENSE`; at merge an identical-content add is a no-op or a
trivial conflict. Flag at merge time.
