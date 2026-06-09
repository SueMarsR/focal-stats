import type { BrandId } from './brand';
import { detectBrand } from './brand';

export type BodyType = 'phone' | 'camera' | 'action-cam' | 'unknown';

// Brands that, in practice, only show up in photo EXIF as phones.
const PHONE_BRANDS: ReadonlySet<BrandId> = new Set(['apple', 'google', 'xiaomi', 'huawei', 'oneplus']);

/** Samsung and Sony make both phones and cameras — disambiguate by model string. */
function looksLikePhone(model: string | null): boolean {
  const md = (model ?? '').trim();
  return (
    /^sm-|galaxy/i.test(md) || // Samsung Galaxy
    /^xq-|^so-|xperia/i.test(md) || // Sony Xperia (recent)
    /^[fghij]\d{4}$/i.test(md) // Sony Xperia (older, e.g. G8341)
  );
}

/**
 * Coarse body class from EXIF Make/Model: phone / camera / action-cam / unknown.
 * Used to pick a generic body glyph on the share card. Pure and deterministic.
 * Precise mirrorless-vs-DSLR-vs-medium-format is out of scope (needs a model table).
 */
export function detectBodyType(make: string | null, model: string | null): BodyType {
  const brand = detectBrand(make, model);
  if (!brand) return 'unknown';
  if (brand.id === 'dji' || brand.id === 'gopro') return 'action-cam';
  if (PHONE_BRANDS.has(brand.id)) return 'phone';
  if (brand.id === 'samsung' || brand.id === 'sony') {
    return looksLikePhone(model) ? 'phone' : 'camera';
  }
  return 'camera'; // remaining are camera / lens makers
}
