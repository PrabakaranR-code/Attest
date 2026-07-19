import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class InvalidUrlError extends Error {
  readonly code = 'INVALID_URL';
}

export class SsrfBlockedError extends Error {
  readonly code = 'SSRF_BLOCKED';
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

function inCidr4(ip: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) >>> 0 === (ipv4ToInt(base) & mask) >>> 0;
}

const PRIVATE_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
];

export function isPrivateIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    return PRIVATE_V4.some(([base, prefix]) => inCidr4(ip, base, prefix));
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9')) return true; // fe80::/10 (common forms)
    if (lower.startsWith('fea') || lower.startsWith('feb')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateIp(mapped[1]);
  }
  return false;
}

/**
 * SSRF guard: only http(s), no localhost, no private/reserved ranges — checked
 * against both the hostname literal and its DNS resolution. `allowPrivate`
 * (ATTEST_ALLOW_PRIVATE) turns off the range checks for tests and trusted
 * intranet use; scheme validation always applies.
 */
export async function assertAllowedUrl(rawUrl: string, allowPrivate: boolean): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new InvalidUrlError(`not a valid URL: ${JSON.stringify(rawUrl)}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidUrlError(`only http(s) URLs are supported, got ${url.protocol}`);
  }
  if (allowPrivate) return url;

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new SsrfBlockedError('localhost is not allowed');
  }
  if (isIP(hostname) && isPrivateIp(hostname)) {
    throw new SsrfBlockedError(`address ${hostname} is in a private range`);
  }
  if (!isIP(hostname)) {
    try {
      const addrs = await lookup(hostname, { all: true });
      for (const { address } of addrs) {
        if (isPrivateIp(address)) {
          throw new SsrfBlockedError(`${hostname} resolves to private address ${address}`);
        }
      }
    } catch (err) {
      if (err instanceof SsrfBlockedError) throw err;
      // DNS failure: let navigation fail naturally (502) rather than 400 here.
    }
  }
  return url;
}
