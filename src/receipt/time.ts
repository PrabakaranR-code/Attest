import { performance } from 'node:perf_hooks';

/**
 * Current UTC time as YYYY-MM-DDTHH:MM:SS.ssssssZ with microsecond precision,
 * derived from performance.timeOrigin + performance.now() (sub-millisecond clock).
 */
export function nowUtcMicros(): string {
  const epochMicros = Math.round((performance.timeOrigin + performance.now()) * 1000);
  return epochMicrosToUtc(epochMicros);
}

export function epochMicrosToUtc(epochMicros: number): string {
  const seconds = Math.floor(epochMicros / 1_000_000);
  const micros = epochMicros - seconds * 1_000_000;
  const base = new Date(seconds * 1000).toISOString().slice(0, 19);
  return `${base}.${String(micros).padStart(6, '0')}Z`;
}

export const UTC_MICROS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
