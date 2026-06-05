import { describe, expect, it } from 'vitest';
import { normalizeFocal } from './normalize';
import type { PhotoExif } from './types';

const base: PhotoExif = {
  name: 'a.jpg', focalLength: 35, focalLength35mm: 52,
  lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
};

describe('normalizeFocal', () => {
  it('raw 模式取原始焦距', () => {
    expect(normalizeFocal(base, 'raw')).toEqual({ focal: 35, fellBack: false });
  });
  it('equiv35 模式取等效焦距', () => {
    expect(normalizeFocal(base, 'equiv35')).toEqual({ focal: 52, fellBack: false });
  });
  it('equiv35 缺失时回退原始并标记 fellBack', () => {
    expect(normalizeFocal({ ...base, focalLength35mm: null }, 'equiv35'))
      .toEqual({ focal: 35, fellBack: true });
  });
  it('两者都缺返回 null', () => {
    expect(normalizeFocal({ ...base, focalLength: null, focalLength35mm: null }, 'equiv35'))
      .toEqual({ focal: null, fellBack: false });
  });
});
