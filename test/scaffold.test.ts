import { describe, expect, it } from 'vitest';
import { ENGINE_NAME, ENGINE_VERSION } from '../src/version.js';

describe('scaffold', () => {
  it('exposes engine name and version', () => {
    expect(ENGINE_NAME).toBe('attest');
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
