---
phase: "10"
slug: "10-magic-links-transactional-email"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser client → GoTrue `/otp` | Client submits email to initiate magic link or request OTP code; untrusted input | Email string, submission metadata |
| GoTrue → SMTP upstream (`smtp.resend.com:465` / Inbucket) | GoTrue delivers generated OTP / magic link email over TLS | Recipient email, OTP token, template HTML |
| Inbucket test-double → test runner | E2E test harness polls Inbucket REST API on loopback | Intercepted test email payloads, OTP codes |
| GoTrue `/verify` → browser redirect | User clicks email link or enters OTP; redirects to app origin | Session token, redirect target URI |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Elevation of Privilege | GoTrue auth service | high | mitigate | `GOTRUE_DISABLE_SIGNUP: 'true'` in `docker/docker-compose.yml`, preventing public self-registration while preserving admin provisioning via `service_role`. | closed |
| T-10-02 | Spoofing | GoTrue auth service | high | mitigate | Strict origin locking with `GOTRUE_SITE_URL: ${HESTIA_ORIGIN}` and `GOTRUE_URI_ALLOW_LIST: ${HESTIA_ORIGIN},${HESTIA_ORIGIN}/**`. | closed |
| T-10-03 | Elevation of Privilege | GoTrue OTP generation | medium | mitigate | OTP expiry tightened from 3600s to 900s (15 min) via `GOTRUE_MAILER_OTP_EXP: 900`. | closed |
| T-10-04 | Information Disclosure | Web client auth | medium | mitigate | Client passes `shouldCreateUser: false` and maps uninvited emails to generic `UNKNOWN_EMAIL_MESSAGE`. | closed |
| T-10-05 | Denial of Service | Web client UI | low | mitigate | 30-second cooldown timer on resend actions in `MagicLinkCodeScreen.tsx`. | closed |
| T-10-06 | Elevation of Privilege | GoTrue OTP validation | high | mitigate | One-time code invalidation on use/expiry; invalid code `000000` returns 400 and fails session creation. | closed |
| T-10-07 | Spoofing | GoTrue redirect handler | high | mitigate | Rejection of external redirect URIs outside `${HESTIA_ORIGIN}` verified in E2E suite. | closed |
| T-10-08 | Denial of Service | GoTrue mailer | high | mitigate | Zero outbound emails generated for uninvited/unknown email addresses when signup is disabled. | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-10-01 | T-10-05 | Client-side 30-second cooldown can be bypassed by manual API calls, but GoTrue backend rate limiting (`GOTRUE_RATE_LIMIT_EMAIL_SENT`) provides secondary defense. | Owner | 2026-11-01 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 8 | 8 | 0 | gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01
