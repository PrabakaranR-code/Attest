import { describe, expect, it } from 'vitest';
import { epochMicrosToUtc, nowUtcMicros, UTC_MICROS_REGEX } from '../src/receipt/time.js';

describe('nowUtcMicros', () => {
  it('matches YYYY-MM-DDTHH:MM:SS.ssssssZ', () => {
    expect(nowUtcMicros()).toMatch(UTC_MICROS_REGEX);
  });

  it('is close to the system clock', () => {
    const stamp = nowUtcMicros();
    const parsedMs = Date.parse(stamp.slice(0, 23) + 'Z');
    expect(Math.abs(Date.now() - parsedMs)).toBeLessThan(5_000);
  });

  it('never runs backwards across consecutive calls', () => {
    let prev = nowUtcMicros();
    for (let i = 0; i < 50; i++) {
      const next = nowUtcMicros();
      expect(next >= prev).toBe(true);
      prev = next;
    }
  });
});

describe('epochMicrosToUtc', () => {
  it('formats a known epoch with full microsecond precision', () => {
    expect(epochMicrosToUtc(1_700_000_000_123_456)).toBe('2023-11-14T22:13:20.123456Z');
  });

  it('pads sub-millisecond fractions', () => {
    expect(epochMicrosToUtc(1_700_000_000_000_007)).toBe('2023-11-14T22:13:20.000007Z');
  });
});
