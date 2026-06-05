import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractExif, mapTags } from './exif';

describe('mapTags', () => {
  it('从 description/value 提取并四舍五入焦距', () => {
    const tags = {
      FocalLength: { description: '35 mm', value: [350, 10] },
      FocalLengthIn35mmFilm: { value: 52 },
      LensModel: { description: 'FE 35mm F1.8' },
      Make: { description: 'SONY' },
      Model: { description: 'ILCE-7M3' },
      FNumber: { description: 'f/1.8', value: [18, 10] },
    };
    expect(mapTags(tags, 'a.arw')).toEqual({
      name: 'a.arw',
      focalLength: 35,
      focalLength35mm: 52,
      lensModel: 'FE 35mm F1.8',
      cameraMake: 'SONY',
      cameraModel: 'ILCE-7M3',
      fNumber: 1.8,
    });
  });

  it('缺失字段返回 null', () => {
    expect(mapTags({}, 'b.jpg')).toEqual({
      name: 'b.jpg', focalLength: null, focalLength35mm: null,
      lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
    });
  });

  it('支持 FocalLengthIn35mmFormat 别名', () => {
    const photo = mapTags({ FocalLengthIn35mmFormat: { value: 75 } }, 'c.jpg');
    expect(photo.focalLength35mm).toBe(75);
  });
});

describe('extractExif (集成)', () => {
  it('读取夹具 JPEG 的焦距', () => {
    const buf = readFileSync(new URL('../test/fixtures/sample.jpg', import.meta.url));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const r = extractExif(ab, 'sample.jpg');
    expect('reason' in r).toBe(false);
    if (!('reason' in r)) {
      expect(r.focalLength).toBe(35);
      expect(r.focalLength35mm).toBe(52);
      expect(r.cameraModel).toBe('ILCE-7M3');
    }
  });

  it('非图片数据返回 no-exif 或 parse-error', () => {
    const r = extractExif(new TextEncoder().encode('not an image').buffer, 'x.txt');
    expect('reason' in r).toBe(true);
  });
});
