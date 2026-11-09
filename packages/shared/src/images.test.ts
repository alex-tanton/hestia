import { describe, expect, it } from 'vitest';
import { ALLOWED_IMAGE_DOMAINS, isAllowedImageUrl } from './images.js';

describe('ALLOWED_IMAGE_DOMAINS', () => {
  it('contains exactly the approved CDN root domains', () => {
    expect(ALLOWED_IMAGE_DOMAINS).toEqual([
      'flipp.com',
      'wishabi.com',
      'wishabi.net',
      'openfoodfacts.org',
    ]);
  });
});

describe('isAllowedImageUrl', () => {
  describe('negative test cases: rejected inputs', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty string', ''],
      ['invalid URL', 'not-a-url'],
      ['relative path', '/images/item.png'],
      ['insecure HTTP', 'http://flipp.com/item.png'],
      ['spoofed domain prefix', 'https://attacker-flipp.com/item.png'],
      ['spoofed domain suffix', 'https://flipp.com.attacker.com/item.png'],
      ['unrelated domain', 'https://evil.com/item.png'],
    ])('returns false for %s (%s)', (_name, input) => {
      expect(isAllowedImageUrl(input)).toBe(false);
    });

    it('returns false for insecure HTTP URL object', () => {
      expect(isAllowedImageUrl(new URL('http://f.wishabi.net/flyer.jpg'))).toBe(false);
    });

    it('returns false for disallowed domain URL object', () => {
      expect(isAllowedImageUrl(new URL('https://evil.com/image.png'))).toBe(false);
    });
  });

  describe('positive test cases: allowed origins', () => {
    it.each([
      ['flipp.com apex', 'https://flipp.com/flyer.jpg'],
      ['flipp dam subdomain', 'https://dam.flipp.com/item.png'],
      ['flipp image retrieval subdomain', 'https://flipp-image-retrieval.flipp.com/image.jpg'],
      ['wishabi.net f subdomain', 'https://f.wishabi.net/flyer.jpg'],
      ['wishabi.net images subdomain', 'https://images.wishabi.net/logo.png'],
      [
        'openfoodfacts images subdomain',
        'https://images.openfoodfacts.org/images/products/001.jpg',
      ],
      ['wishabi.com apex', 'https://wishabi.com/logo.png'],
      ['wishabi.com subdomain', 'https://assets.wishabi.com/logo.png'],
      ['openfoodfacts.org apex', 'https://openfoodfacts.org/logo.png'],
    ])('returns true for %s (%s)', (_name, input) => {
      expect(isAllowedImageUrl(input)).toBe(true);
    });

    it('accepts valid WHATWG URL objects', () => {
      expect(isAllowedImageUrl(new URL('https://dam.flipp.com/item.png'))).toBe(true);
      expect(isAllowedImageUrl(new URL('https://images.openfoodfacts.org/001.jpg'))).toBe(true);
    });

    it('normalizes uppercase hostnames', () => {
      expect(isAllowedImageUrl('https://DAM.FLIPP.COM/item.png')).toBe(true);
      expect(isAllowedImageUrl('https://Images.Wishabi.Net/item.png')).toBe(true);
    });
  });
});
