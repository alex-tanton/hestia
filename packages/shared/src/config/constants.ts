/**
 * Canonical default constants used across service, web, db, and tests.
 * Single source of truth for auth policies, rate limits, and test harness defaults.
 */

export const AUTH_CONFIG = Object.freeze({
  /** JWT validity period in seconds (1 hour). */
  JWT_EXPIRY_SECONDS: 3600,
  /** Minimum password length enforced across GoTrue, UI validation, and database. */
  PASSWORD_MIN_LENGTH: 8,
  /** bcrypt maximum byte length for passwords. */
  PASSWORD_MAX_LENGTH: 72,
  /** Length of one-time password (OTP) codes for magic links and email confirmations. */
  OTP_LENGTH: 6,
  /** Expiration period for OTP codes in seconds (15 minutes). */
  OTP_EXPIRY_SECONDS: 900,
});

export const RATE_LIMIT_CONFIG = Object.freeze({
  /** Default per-IP requests per minute across /api/* endpoints in production. */
  DEFAULT_PER_MINUTE: 300,
  /** Per-IP requests per minute in the E2E test overlay to prevent loopback rate-limiting. */
  E2E_OVERLAY_PER_MINUTE: 3000,
});

export const DEFAULT_RATE_LIMIT_PER_MINUTE = RATE_LIMIT_CONFIG.DEFAULT_PER_MINUTE;

export const TEST_CONFIG = Object.freeze({
  /** Shared password used for all development and test seed users. */
  SEED_PASSWORD: 'hestia-seed-pass-2026',
  /** Pinned instant for Vitest test runs to guarantee deterministic time checks. */
  DEFAULT_TEST_NOW: '2026-10-14T12:00:00.000Z',
  /** Default database URL for local supabase start. */
  DEFAULT_DEV_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  /** Default GoTrue auth endpoint through Kong in local supabase start. */
  DEFAULT_DEV_AUTH_URL: 'http://127.0.0.1:54321/auth/v1',
  /** Default backend service port/URL during local development. */
  DEFAULT_DEV_API_URL: 'http://127.0.0.1:3000',
});
