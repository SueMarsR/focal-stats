import { describe, expect, it } from 'vitest';
import { mapPool } from './pool';

describe('mapPool', () => {
  it('保持顺序并处理全部元素', async () => {
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });
  it('并发不超过上限', async () => {
    let active = 0;
    let maxActive = 0;
    await mapPool(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return 0;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });
  it('fn 抛出时 mapPool 拒绝', async () => {
    await expect(
      mapPool([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });
});
