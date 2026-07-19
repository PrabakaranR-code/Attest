import { describe, expect, it } from 'vitest';
import { MemoryGuard } from '../src/engine/memguard.js';

describe('MemoryGuard', () => {
  it('triggers recycle when RSS exceeds the limit', () => {
    let recycled = 0;
    const guard = new MemoryGuard(
      100,
      () => {
        recycled += 1;
      },
      () => 150 * 1024 * 1024,
    );
    expect(guard.checkNow()).toBe(true);
    expect(recycled).toBe(1);
  });

  it('stays quiet under the limit', () => {
    let recycled = 0;
    const guard = new MemoryGuard(
      100,
      () => {
        recycled += 1;
      },
      () => 50 * 1024 * 1024,
    );
    expect(guard.checkNow()).toBe(false);
    expect(recycled).toBe(0);
  });
});
