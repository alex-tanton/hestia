import { describe, expect, it } from 'vitest';
import { isPrivateAddress } from './private-address.js';

/**
 * Private/loopback/link-local refusal (Technical Architecture, "Recipe fetching"). Checked
 * against the resolved IP itself, which is what `resolveAllowedAddresses` in `fetch-recipe.ts`
 * feeds it — this file only proves the range table is right.
 */
describe('isPrivateAddress', () => {
  it.each([
    ['127.0.0.1', true], // loopback
    ['127.255.255.255', true],
    ['169.254.169.254', true], // cloud metadata endpoint, link-local
    ['169.254.0.1', true],
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.0.1', true],
    ['192.168.255.255', true],
    ['100.64.0.1', true], // carrier-grade NAT
    ['0.0.0.0', true],
  ])('refuses IPv4 %s', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });

  it.each([
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['93.184.216.34', false],
    ['172.15.255.255', false], // just outside 172.16.0.0/12
    ['172.32.0.0', false], // just outside 172.16.0.0/12
    ['11.0.0.1', false], // just outside 10.0.0.0/8
  ])('allows public IPv4 %s', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });

  it.each([
    ['::1', true], // loopback
    ['::', true], // unspecified
    ['fe80::1', true], // link-local
    ['fc00::1', true], // unique local
    ['fd12:3456:789a::1', true], // unique local
    ['::ffff:127.0.0.1', true], // IPv4-mapped loopback
    ['::ffff:10.0.0.1', true], // IPv4-mapped private
  ])('refuses IPv6 %s', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });

  it.each([
    ['2001:4860:4860::8888', false], // a real public address (Google DNS)
    ['::ffff:8.8.8.8', false], // IPv4-mapped public
  ])('allows public IPv6 %s', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });

  it('refuses anything that is not a recognizable IP literal', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
    expect(isPrivateAddress('example.com')).toBe(true);
  });
});
