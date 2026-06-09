import { describe, it, expect } from 'vitest';
import { detectBodyType } from './body-type';

describe('detectBodyType', () => {
  it('classifies phones', () => {
    expect(detectBodyType('Apple', 'iPhone 15 Pro')).toBe('phone');
    expect(detectBodyType(null, 'iPhone 15')).toBe('phone');
    expect(detectBodyType('Google', 'Pixel 8')).toBe('phone');
    expect(detectBodyType('Xiaomi', '2201123G')).toBe('phone');
    expect(detectBodyType('Redmi', 'M2101K6G')).toBe('phone');
    expect(detectBodyType('HUAWEI', 'ELS-AN00')).toBe('phone');
    expect(detectBodyType('OnePlus', 'GM1913')).toBe('phone');
    // Brands that make both phones and cameras → disambiguate by model.
    expect(detectBodyType('samsung', 'SM-S911B')).toBe('phone'); // Galaxy S23
    expect(detectBodyType('SONY', 'XQ-DQ72')).toBe('phone'); // Xperia 1 IV
    expect(detectBodyType('SONY', 'G8341')).toBe('phone'); // Xperia XZ1
  });

  it('classifies interchangeable-lens / compact cameras', () => {
    expect(detectBodyType('SONY', 'ILCE-7M4')).toBe('camera');
    expect(detectBodyType('Canon', 'Canon EOS R6')).toBe('camera');
    expect(detectBodyType('FUJIFILM', 'X-T4')).toBe('camera');
    expect(detectBodyType('NIKON CORPORATION', 'NIKON Z 6')).toBe('camera');
    expect(detectBodyType('LEICA CAMERA AG', 'Q2')).toBe('camera');
    expect(detectBodyType('samsung', 'NX500')).toBe('camera'); // Samsung NX mirrorless
  });

  it('classifies action cams / drones', () => {
    expect(detectBodyType('DJI', 'FC3582')).toBe('action-cam');
    expect(detectBodyType('GoPro', 'HERO11 Black')).toBe('action-cam');
  });

  it('returns unknown when the device cannot be classified', () => {
    expect(detectBodyType(null, null)).toBe('unknown');
    expect(detectBodyType('EPSON', 'GT-X900')).toBe('unknown');
  });
});
