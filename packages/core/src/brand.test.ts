import { describe, it, expect } from 'vitest';
import { detectBrand } from './brand';

describe('detectBrand', () => {
  it('detects brand from the Make field (primary signal)', () => {
    // Sony/Fuji model strings don't contain the brand name, so Make is essential.
    expect(detectBrand('SONY', 'ILCE-7M4')).toEqual({ id: 'sony', name: 'Sony' });
    expect(detectBrand('Canon', 'Canon EOS R6')).toEqual({ id: 'canon', name: 'Canon' });
    expect(detectBrand('NIKON CORPORATION', 'NIKON Z 6')).toEqual({ id: 'nikon', name: 'Nikon' });
    expect(detectBrand('FUJIFILM', 'X-T4')).toEqual({ id: 'fujifilm', name: 'Fujifilm' });
    expect(detectBrand('Apple', 'iPhone 15 Pro')).toEqual({ id: 'apple', name: 'Apple' });
    expect(detectBrand('samsung', 'SM-S911B')).toEqual({ id: 'samsung', name: 'Samsung' });
    expect(detectBrand('Google', 'Pixel 8')).toEqual({ id: 'google', name: 'Google' });
    expect(detectBrand('DJI', 'FC3582')).toEqual({ id: 'dji', name: 'DJI' });
    expect(detectBrand('GoPro', 'HERO11 Black')).toEqual({ id: 'gopro', name: 'GoPro' });
    expect(detectBrand('Hasselblad', 'X1D II 50C')).toEqual({ id: 'hasselblad', name: 'Hasselblad' });
    expect(detectBrand('SIGMA', 'fp')).toEqual({ id: 'sigma', name: 'Sigma' });
    expect(detectBrand('KODAK', 'PIXPRO')).toEqual({ id: 'kodak', name: 'Kodak' });
    expect(detectBrand('OnePlus', 'GM1913')).toEqual({ id: 'oneplus', name: 'OnePlus' });
    expect(detectBrand('HUAWEI', 'ELS-AN00')).toEqual({ id: 'huawei', name: 'Huawei' });
  });

  it('maps brand aliases / sub-brands to the canonical brand', () => {
    expect(detectBrand('OM Digital Solutions', 'OM-1')).toEqual({ id: 'olympus', name: 'OM System' });
    expect(detectBrand('OLYMPUS CORPORATION', 'E-M1')).toEqual({ id: 'olympus', name: 'OM System' });
    expect(detectBrand('Panasonic', 'DC-S5')).toEqual({ id: 'panasonic', name: 'Panasonic' });
    expect(detectBrand('LEICA CAMERA AG', 'Q2')).toEqual({ id: 'leica', name: 'Leica' });
    expect(detectBrand('Xiaomi', '2201123G')).toEqual({ id: 'xiaomi', name: 'Xiaomi' });
    expect(detectBrand('Redmi', 'M2101K6G')).toEqual({ id: 'xiaomi', name: 'Xiaomi' });
  });

  it('treats a Pentax model as Pentax even when Make is Ricoh (Ricoh owns Pentax)', () => {
    expect(detectBrand('RICOH IMAGING COMPANY, LTD.', 'PENTAX K-3 Mark III')).toEqual({
      id: 'pentax',
      name: 'Pentax',
    });
    expect(detectBrand('RICOH', 'GR III')).toEqual({ id: 'ricoh', name: 'Ricoh' });
  });

  it('falls back to unambiguous Model patterns when Make is missing/unknown', () => {
    expect(detectBrand(null, 'iPhone 15 Pro')).toEqual({ id: 'apple', name: 'Apple' });
    expect(detectBrand(null, 'Canon EOS R6')).toEqual({ id: 'canon', name: 'Canon' });
    expect(detectBrand(null, 'Pixel 7')).toEqual({ id: 'google', name: 'Google' });
    expect(detectBrand(null, 'ILCE-7M4')).toEqual({ id: 'sony', name: 'Sony' });
  });

  it('returns null when the brand cannot be determined', () => {
    expect(detectBrand(null, null)).toBeNull();
    expect(detectBrand('', '')).toBeNull();
    expect(detectBrand('EPSON Scanner', 'GT-X900')).toBeNull();
    expect(detectBrand(null, 'SomeUnknownCam 9000')).toBeNull();
  });
});
