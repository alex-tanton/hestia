import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument, type ScalarTag } from 'yaml';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const envSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
const serviceSchema = z.looseObject({
  image: z.string().optional(),
  restart: z.string().optional(),
  command: z.array(z.string()).optional(),
  ports: z.array(z.unknown()).optional(),
  profiles: z.array(z.string()).optional(),
  logging: z.unknown().optional(),
  networks: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
  depends_on: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
  environment: envSchema.optional(),
  healthcheck: z.looseObject({ test: z.array(z.string()) }).optional(),
});
const composeSchema = z.looseObject({
  services: z.record(z.string(), serviceSchema),
});

/** Compose's `!reset` tag, which the overlay uses to drop the base file's ipam block. */
const composeReset: ScalarTag = { tag: '!reset', resolve: () => null };

function readRepoFile(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');
}

function loadCompose(path: string): { messages: string[]; file: z.infer<typeof composeSchema> } {
  const document = parseDocument(readRepoFile(path), { customTags: [composeReset] });
  const messages = [...document.errors, ...document.warnings].map((problem) => problem.message);
  return { messages, file: composeSchema.parse(document.toJS()) };
}

const base = loadCompose('docker/docker-compose.yml');
const overlay = loadCompose('e2e/docker-compose.e2e.yml');

function service(file: z.infer<typeof composeSchema>, name: string): z.infer<typeof serviceSchema> {
  const found = file.services[name];
  if (found === undefined) throw new Error(`no ${name} service`);
  return found;
}

function variable(file: z.infer<typeof composeSchema>, name: string, key: string): unknown {
  return service(file, name).environment?.[key];
}

describe('GoTrue SMTP and transactional email configuration', () => {
  it('locks GoTrue signup, sets OTP expiry to 15m, and configures static template URL', () => {
    expect(base.messages).toEqual([]);
    const auth = (key: string): unknown => variable(base.file, 'auth', key);

    expect(auth('GOTRUE_DISABLE_SIGNUP')).toBe('true');
    expect(auth('GOTRUE_MAILER_AUTOCONFIRM')).toBe('true');
    expect(String(auth('GOTRUE_MAILER_OTP_LENGTH'))).toBe('6');
    expect(String(auth('GOTRUE_MAILER_OTP_EXP'))).toBe('900');
    expect(auth('GOTRUE_SITE_URL')).toBe('${HESTIA_ORIGIN}');
    expect(auth('GOTRUE_URI_ALLOW_LIST')).toBe('${HESTIA_ORIGIN},${HESTIA_ORIGIN}/**');
    expect(auth('GOTRUE_MAILER_TEMPLATES_MAGIC_LINK')).toBe(
      'http://caddy:8080/templates/magic_link.html',
    );
    expect(auth('GOTRUE_MAILER_URLPATHS_MAGIC_LINK')).toBe('/auth/v1/verify');
    expect(auth('GOTRUE_MAILER_SUBJECTS_MAGIC_LINK')).toBe('Your Magic Link');
  });

  it('configures production SMTP variables with fallback defaults', () => {
    const auth = (key: string): unknown => variable(base.file, 'auth', key);

    expect(auth('GOTRUE_SMTP_HOST')).toBe('${GOTRUE_SMTP_HOST:-smtp.resend.com}');
    expect(String(auth('GOTRUE_SMTP_PORT'))).toMatch(/^(465|\${GOTRUE_SMTP_PORT:-465})$/);
    expect(auth('GOTRUE_SMTP_USER')).toBe('${GOTRUE_SMTP_USER:-resend}');
    expect(auth('GOTRUE_SMTP_PASS')).toBe('${GOTRUE_SMTP_PASS:-}');
    expect(auth('GOTRUE_SMTP_ADMIN_EMAIL')).toBe('${GOTRUE_SMTP_ADMIN_EMAIL:-auth@aberrance.app}');
    expect(auth('GOTRUE_SMTP_SENDER_NAME')).toBe('${GOTRUE_SMTP_SENDER_NAME:-Hestia}');
  });

  it('wires inbucket mail-catcher service in E2E compose overlay', () => {
    expect(overlay.messages).toEqual([]);

    const inbucket = service(overlay.file, 'inbucket');
    expect(inbucket.image).toBe('inbucket/inbucket:3.1.0');
    expect(inbucket.ports).toContain('127.0.0.1:${HESTIA_E2E_INBUCKET_PORT:?}:9000');

    const auth = service(overlay.file, 'auth');
    expect(auth.environment?.['GOTRUE_SMTP_HOST']).toBe('inbucket');
    expect(String(auth.environment?.['GOTRUE_SMTP_PORT'])).toBe('2500');

    const dependsOn = auth.depends_on;
    expect(dependsOn).toBeDefined();
    if (Array.isArray(dependsOn)) {
      expect(dependsOn).toContain('inbucket');
    } else {
      expect(Object.keys(dependsOn!)).toContain('inbucket');
    }
  });
});
