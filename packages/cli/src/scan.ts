import { readdir, open } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PHOTO_EXTS = new Set([
  '.jpg', '.jpeg', '.heic', '.heif', '.tif', '.tiff',
  '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.sr2', '.raf', '.orf', '.rw2', '.dng', '.pef',
]);

export async function listPhotoFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await listPhotoFiles(full)));
    else if (PHOTO_EXTS.has(extname(e.name).toLowerCase())) files.push(full);
  }
  return files;
}

export async function readHeader(path: string, headerBytes: number): Promise<ArrayBuffer> {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(headerBytes);
    const { bytesRead } = await fh.read(buf, 0, headerBytes, 0);
    const slice = buf.subarray(0, bytesRead);
    return slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
  } finally {
    await fh.close();
  }
}
