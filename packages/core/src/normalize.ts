import type { PhotoExif } from './types';

export function normalizeFocal(
  photo: PhotoExif,
  mode: 'raw' | 'equiv35',
): { focal: number | null; fellBack: boolean } {
  if (mode === 'raw') return { focal: photo.focalLength, fellBack: false };
  if (photo.focalLength35mm != null) return { focal: photo.focalLength35mm, fellBack: false };
  return { focal: photo.focalLength, fellBack: photo.focalLength != null };
}
