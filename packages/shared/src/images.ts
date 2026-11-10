/**
 * Centralized image domain allowlist and URL validation for store and deal images.
 * Single source of truth across service, web app, and PWA service worker.
 */

export const ALLOWED_IMAGE_DOMAINS = [
  'flipp.com',
  'wishabi.com',
  'wishabi.net',
  'openfoodfacts.org',
] as const;

/**
 * Returns true if the provided URL is a valid, secure HTTPS URL targeting an approved image CDN domain.
 * Supports exact apex domains and arbitrary dot-prefixed subdomains.
 * Returns false on malformed strings, relative paths, insecure HTTP, null, or undefined without throwing.
 */
export function isAllowedImageUrl(url: string | URL | null | undefined): boolean {
  if (!url) {
    return false;
  }

  let parsed: URL;
  if (url instanceof URL) {
    parsed = url;
  } else {
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  return ALLOWED_IMAGE_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}
