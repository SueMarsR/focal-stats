export type BrandId =
  | 'sony'
  | 'canon'
  | 'nikon'
  | 'fujifilm'
  | 'panasonic'
  | 'olympus'
  | 'leica'
  | 'ricoh'
  | 'pentax'
  | 'hasselblad'
  | 'sigma'
  | 'tamron'
  | 'apple'
  | 'samsung'
  | 'google'
  | 'xiaomi'
  | 'huawei'
  | 'oneplus'
  | 'dji'
  | 'gopro'
  | 'kodak';

export interface Brand {
  id: BrandId;
  /** Clean display wordmark, used as the text fallback when no icon is bundled. */
  name: string;
}

interface BrandRule {
  id: BrandId;
  name: string;
  /** Substrings matched (case-insensitive) against the EXIF Make field. */
  make: string[];
  /** Substrings matched against the Model field — fallback when Make is absent. */
  model: string[];
}

// Order matters: more specific rules first. Pentax precedes Ricoh because Ricoh
// owns Pentax and Pentax bodies report Make "RICOH IMAGING COMPANY, LTD." while
// the user thinks "Pentax" — a Pentax model string wins. Make is the primary,
// reliable brand signal (Sony/Fuji/Apple models don't contain the brand name);
// Model patterns are a conservative fallback only.
const BRAND_RULES: readonly BrandRule[] = [
  { id: 'pentax', name: 'Pentax', make: ['pentax'], model: ['pentax'] },
  { id: 'ricoh', name: 'Ricoh', make: ['ricoh'], model: [] },
  { id: 'olympus', name: 'OM System', make: ['om digital', 'om system', 'olympus'], model: [] },
  { id: 'fujifilm', name: 'Fujifilm', make: ['fujifilm', 'fuji'], model: ['gfx'] },
  { id: 'panasonic', name: 'Panasonic', make: ['panasonic', 'lumix'], model: ['lumix'] },
  { id: 'sony', name: 'Sony', make: ['sony'], model: ['ilce', 'dsc-', 'slt-', 'nex-'] },
  { id: 'canon', name: 'Canon', make: ['canon'], model: ['eos', 'powershot'] },
  { id: 'nikon', name: 'Nikon', make: ['nikon'], model: [] },
  { id: 'leica', name: 'Leica', make: ['leica'], model: [] },
  { id: 'hasselblad', name: 'Hasselblad', make: ['hasselblad'], model: [] },
  { id: 'sigma', name: 'Sigma', make: ['sigma'], model: [] },
  { id: 'tamron', name: 'Tamron', make: ['tamron'], model: [] },
  { id: 'gopro', name: 'GoPro', make: ['gopro'], model: ['hero'] },
  { id: 'dji', name: 'DJI', make: ['dji'], model: [] },
  { id: 'apple', name: 'Apple', make: ['apple'], model: ['iphone', 'ipad'] },
  { id: 'google', name: 'Google', make: ['google'], model: ['pixel'] },
  { id: 'samsung', name: 'Samsung', make: ['samsung'], model: [] },
  { id: 'xiaomi', name: 'Xiaomi', make: ['xiaomi', 'redmi', 'poco'], model: [] },
  { id: 'huawei', name: 'Huawei', make: ['huawei', 'honor'], model: [] },
  { id: 'oneplus', name: 'OnePlus', make: ['oneplus'], model: [] },
  { id: 'kodak', name: 'Kodak', make: ['kodak'], model: [] },
];

/**
 * Map an EXIF Make (+ Model fallback) to a canonical camera/phone brand.
 * Returns `null` when the brand can't be determined — callers fall back to the
 * raw model text. Pure and deterministic.
 */
export function detectBrand(make: string | null, model: string | null): Brand | null {
  const m = (make ?? '').toLowerCase();
  const md = (model ?? '').toLowerCase();
  for (const rule of BRAND_RULES) {
    const makeHit = rule.make.some((k) => m.includes(k));
    const modelHit = rule.model.some((k) => md.includes(k));
    if (makeHit || modelHit) return { id: rule.id, name: rule.name };
  }
  return null;
}
