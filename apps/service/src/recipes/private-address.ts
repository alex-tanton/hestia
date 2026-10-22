import { isIP } from 'node:net';

/**
 * Refuses private, loopback, and link-local address ranges. Checked against the resolved IP, never
 * the URL's hostname text, because a hostname can resolve to a private address (DNS rebinding)
 * regardless of how public-looking it reads.
 */

/** [network, prefix bits], IPv4. */
const IPV4_BLOCKED: readonly (readonly [string, number])[] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (includes cloud metadata endpoints)
  ['172.16.0.0', 12], // private
  ['192.168.0.0', 16], // private
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((accumulator, part) => (accumulator << 8) + Number(part), 0) >>> 0;
}

function inIpv4Range(ip: string, network: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(network) & mask);
}

function isBlockedIpv4(ip: string): boolean {
  return IPV4_BLOCKED.some(([network, bits]) => inIpv4Range(ip, network, bits));
}

/** The first hextet as a number, so prefix checks are one bitwise comparison. */
function firstHextet(ip: string): number {
  const [first = '0'] = ip.split(':');
  return parseInt(first === '' ? '0' : first, 16);
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true; // loopback, unspecified
  if (normalized.startsWith('::ffff:')) {
    // An IPv4-mapped address carries the real, checkable address after the prefix.
    const mapped = normalized.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return isBlockedIpv4(mapped);
  }
  const first = firstHextet(normalized);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7, unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10, link-local
  return false;
}

/** True for a private, loopback, link-local, or otherwise unroutable address. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  // Not a recognizable IP literal at all: refuse rather than guess at its shape.
  return true;
}
