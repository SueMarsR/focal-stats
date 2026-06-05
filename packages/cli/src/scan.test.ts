import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listPhotoFiles, readHeader } from './scan';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fs-scan-'));
  await mkdir(join(dir, 'sub'));
  await writeFile(join(dir, 'a.JPG'), 'AAAAAAAA');
  await writeFile(join(dir, 'b.cr2'), 'BBBB');
  await writeFile(join(dir, 'ignore.txt'), 'x');
  await writeFile(join(dir, 'sub', 'c.nef'), 'CCCC');
});
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe('scan', () => {
  it('递归列出照片扩展名，忽略其它', async () => {
    const files = await listPhotoFiles(dir);
    expect(files.map((f) => f.split('/').pop()).sort()).toEqual(['a.JPG', 'b.cr2', 'c.nef']);
  });
  it('readHeader 只读前 N 字节', async () => {
    const ab = await readHeader(join(dir, 'a.JPG'), 4);
    expect(new TextDecoder().decode(ab)).toBe('AAAA');
  });
});
