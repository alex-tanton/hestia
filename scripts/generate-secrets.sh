#!/usr/bin/env bash
# Writes a fresh .env from .env.example with every secret generated.
#
#   scripts/generate-secrets.sh [output-path]      (default: $HEARTH_ENV_FILE or /srv/hearth/.env)
#
# HEARTH_ORIGIN, HEARTH_OWNER_EMAIL, and BACKUP_DIR are copied from the environment when set,
# otherwise left as .env.example's placeholders for the owner to fill in. Refuses to overwrite an
# existing file: regenerating secrets on a live install locks every user out and strands the
# database.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-${HEARTH_ENV_FILE:-/srv/hearth/.env}}"

if [[ -e "$out" ]]; then
  echo "generate-secrets: $out already exists; not overwriting it." >&2
  exit 1
fi

mkdir -p "$(dirname "$out")"
# Created private before any secret is written into it.
(umask 077 && : >"$out")
trap 'rm -f "$out"' ERR

EXAMPLE="$repo_root/.env.example" OUT="$out" node --input-type=module - <<'EOF'
import { createHmac, generateKeyPairSync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const hex = (bytes) => randomBytes(bytes).toString('hex');
const b64url = (value) => Buffer.from(value).toString('base64url');

function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

// web-push takes the public key as the uncompressed P-256 point and the private key as the raw
// scalar, both base64url.
function vapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  const point = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pub.x, 'base64url'),
    Buffer.from(pub.y, 'base64url'),
  ]);
  return { publicKey: point.toString('base64url'), privateKey: priv.d };
}

const jwtSecret = hex(32);
const issuedAt = Math.floor(Date.now() / 1000);
const expiresAt = issuedAt + 10 * 365 * 24 * 60 * 60;
const vapid = vapidKeys();

const generated = {
  POSTGRES_PASSWORD: hex(24),
  HEARTH_SERVICE_DB_PASSWORD: hex(24),
  JWT_SECRET: jwtSecret,
  ANON_KEY: signJwt({ role: 'anon', iss: 'supabase', iat: issuedAt, exp: expiresAt }, jwtSecret),
  SERVICE_ROLE_KEY: signJwt(
    { role: 'service_role', iss: 'supabase', iat: issuedAt, exp: expiresAt },
    jwtSecret,
  ),
  REALTIME_SECRET_KEY_BASE: hex(32),
  REALTIME_DB_ENC_KEY: hex(8),
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
};
const fromEnvironment = ['HEARTH_ORIGIN', 'HEARTH_OWNER_EMAIL', 'BACKUP_DIR'];

const lines = readFileSync(process.env.EXAMPLE, 'utf8')
  .split('\n')
  .map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    if (!match) return line;
    const key = match[1];
    if (key in generated) return `${key}=${generated[key]}`;
    if (fromEnvironment.includes(key) && process.env[key]) return `${key}=${process.env[key]}`;
    return line;
  });
const missing = Object.keys(generated).filter((key) => !lines.some((l) => l.startsWith(`${key}=`)));
if (missing.length > 0) throw new Error(`.env.example lacks ${missing.join(', ')}`);

writeFileSync(process.env.OUT, lines.join('\n'));
EOF

echo "generate-secrets: wrote $out"
if grep -Eq '^HEARTH_ORIGIN=.*<machine>|^HEARTH_OWNER_EMAIL=owner@example\.com$' "$out"; then
  echo "generate-secrets: now set HEARTH_ORIGIN, HEARTH_OWNER_EMAIL, and BACKUP_DIR in $out" >&2
fi
