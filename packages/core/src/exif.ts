import ExifReader from 'exifreader';
import type { PhotoExif, SkippedFile } from './types';

type Tag = { value?: unknown; description?: unknown } | undefined;
type Tags = Record<string, Tag>;

function num(tag: Tag): number | null {
  if (!tag) return null;
  const v = tag.value;
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
    return v[1] === 0 ? null : v[0] / v[1];
  }
  if (typeof v === 'string' && !Number.isNaN(parseFloat(v))) return parseFloat(v);
  if (typeof tag.description === 'string' && !Number.isNaN(parseFloat(tag.description))) {
    return parseFloat(tag.description);
  }
  return null;
}

function str(tag: Tag): string | null {
  if (!tag) return null;
  if (typeof tag.description === 'string' && tag.description.length > 0) return tag.description;
  if (typeof tag.value === 'string' && tag.value.length > 0) return tag.value;
  if (Array.isArray(tag.value)) return tag.value.join(' ').trim() || null;
  return null;
}

const round = (n: number | null): number | null => (n == null ? null : Math.round(n));

export function mapTags(tags: Tags, name: string): PhotoExif {
  return {
    name,
    focalLength: round(num(tags.FocalLength)),
    focalLength35mm: round(num(tags.FocalLengthIn35mmFilm) ?? num(tags.FocalLengthIn35mmFormat)),
    lensModel: str(tags.LensModel) ?? str(tags.Lens),
    cameraMake: str(tags.Make),
    cameraModel: str(tags.Model),
    fNumber: num(tags.FNumber),
  };
}

export function extractExif(buffer: ArrayBuffer, name: string): PhotoExif | SkippedFile {
  let tags: Tags;
  try {
    tags = ExifReader.load(buffer) as unknown as Tags;
  } catch {
    return { name, reason: 'parse-error' };
  }
  if (!tags || Object.keys(tags).length === 0) return { name, reason: 'no-exif' };
  return mapTags(tags, name);
}
