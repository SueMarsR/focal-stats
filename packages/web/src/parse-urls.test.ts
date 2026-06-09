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

  it('为每个请求传入 AbortSignal（超时保护，避免单个 URL 卡死整批）', async () => {
    let seenSignal: AbortSignal | undefined;
    const fetchFn: FetchLike = async (_u, init) => {
      seenSignal = init?.signal;
      return new Response(fixtureBytes, { status: 200 });
    };
    await parseUrls(['https://h/a.jpg'], 1024 * 1024, undefined, fetchFn);
    expect(seenSignal).toBeInstanceOf(AbortSignal);
  });

  it('body 为 null 时回退到 arrayBuffer 并解析', async () => {
    const fetchFn: FetchLike = async () =>
      ({ ok: true, body: null, arrayBuffer: async () => fixtureBytes.buffer } as unknown as Response);
    const { photos } = await parseUrls(['https://h/n.jpg'], 1024 * 1024, undefined, fetchFn);
    expect(photos).toHaveLength(1);
    expect(photos[0].focalLength35mm).toBe(52);
  });
});
