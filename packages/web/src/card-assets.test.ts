import { describe, it, expect } from 'vitest';
import { BRAND_ICONS } from './brand-icons';
import { BODY_GLYPHS } from './body-glyphs';

const EXPECTED_BRANDS = [
  'sony', 'nikon', 'fujifilm', 'panasonic', 'leica', 'apple', 'samsung',
  'google', 'xiaomi', 'huawei', 'oneplus', 'dji', 'kodak',
] as const;

describe('BRAND_ICONS (vendored Simple Icons)', () => {
  it('covers exactly the 13 verified brands with non-empty 24x24 paths', () => {
    expect(Object.keys(BRAND_ICONS).sort()).toEqual([...EXPECTED_BRANDS].sort());
    for (const id of EXPECTED_BRANDS) {
      const g = BRAND_ICONS[id];
      expect(g, id).toBeTruthy();
      expect(g!.viewBox).toBe('0 0 24 24');
      expect(g!.path.length).toBeGreaterThan(10);
      // Path data must never contain a quote — it goes inside an SVG attribute.
      expect(g!.path).not.toContain('"');
      expect(g!.path).not.toContain("'");
    }
  });

  it('omits brands Simple Icons does not carry (text-fallback brands)', () => {
    for (const id of ['canon', 'olympus', 'ricoh', 'pentax', 'hasselblad', 'sigma', 'tamron', 'gopro'] as const) {
      expect(BRAND_ICONS[id]).toBeUndefined();
    }
  });
});

describe('BODY_GLYPHS (self-authored, brand-neutral)', () => {
  it('provides a glyph for every body class plus lens', () => {
    for (const key of ['camera', 'phone', 'action-cam', 'lens'] as const) {
      const g = BODY_GLYPHS[key];
      expect(g, key).toBeTruthy();
      expect(g.viewBox).toBe('0 0 24 24');
      expect(g.path.length).toBeGreaterThan(10);
      expect(g.path).not.toContain('"');
      expect(g.path).not.toContain("'");
    }
  });
});
