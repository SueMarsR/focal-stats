import { describe, expect, it } from 'vitest';
import { isMobileUA } from './device';

describe('isMobileUA', () => {
  it('iPhone → true', () => {
    expect(isMobileUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', 5)).toBe(true);
  });
  it('Android → true', () => {
    expect(isMobileUA('Mozilla/5.0 (Linux; Android 14; Pixel) Chrome Mobile', 5)).toBe(true);
  });
  it('iPad (explicit UA) → true', () => {
    expect(isMobileUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari', 5)).toBe(true);
  });
  it('iPadOS masquerading as Macintosh but with touch → true', () => {
    expect(isMobileUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari', 5)).toBe(true);
  });
  it('desktop Mac (no touch) → false', () => {
    expect(isMobileUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari', 0)).toBe(false);
  });
  it('Windows desktop → false', () => {
    expect(isMobileUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome', 0)).toBe(false);
  });
  it('Windows touch laptop → false (folder picker is still fine on desktop)', () => {
    expect(isMobileUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome', 5)).toBe(false);
  });
});
