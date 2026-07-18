import { describe, expect, it } from 'vitest';
import {
  assertAllowedUrl,
  InvalidUrlError,
  isPrivateIp,
  SsrfBlockedError,
} from '../src/api/ssrf.js';

describe('isPrivateIp', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '0.0.0.0',
    '100.64.1.1',
    '::1',
    'fc00::1',
    'fd12::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:192.168.0.5',
  ])('flags %s as private', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111', '93.184.216.34'])(
    'allows public %s',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );
});

describe('assertAllowedUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertAllowedUrl('file:///etc/passwd', false)).rejects.toBeInstanceOf(
      InvalidUrlError,
    );
    await expect(assertAllowedUrl('ftp://example.com/', false)).rejects.toBeInstanceOf(
      InvalidUrlError,
    );
  });

  it('rejects garbage URLs', async () => {
    await expect(assertAllowedUrl('not a url', false)).rejects.toBeInstanceOf(InvalidUrlError);
  });

  it('rejects localhost and private IP literals', async () => {
    await expect(assertAllowedUrl('http://localhost/', false)).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    await expect(assertAllowedUrl('http://127.0.0.1:8080/x', false)).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    await expect(assertAllowedUrl('http://192.168.1.10/', false)).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    await expect(assertAllowedUrl('http://[::1]/', false)).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('allows private targets when allowPrivate is set (test/intranet mode)', async () => {
    const url = await assertAllowedUrl('http://127.0.0.1:9999/fixture', true);
    expect(url.hostname).toBe('127.0.0.1');
  });

  it('still rejects bad schemes in allowPrivate mode', async () => {
    await expect(assertAllowedUrl('file:///etc/passwd', true)).rejects.toBeInstanceOf(
      InvalidUrlError,
    );
  });

  it('allows public hostnames', async () => {
    const url = await assertAllowedUrl('https://example.com/page', false);
    expect(url.hostname).toBe('example.com');
  });
});
