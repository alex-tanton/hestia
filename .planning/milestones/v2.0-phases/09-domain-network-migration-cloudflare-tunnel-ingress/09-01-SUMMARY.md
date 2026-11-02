---
phase: 09-domain-network-migration-cloudflare-tunnel-ingress
plan: 01
subsystem: infra
tags: [cloudflare-tunnel, cloudflared, caddy, docker-compose, ingress, playwright, vitest]

requires:
  - phase: 08-full-rebrand-to-hestia
    provides: Hestia names for the Compose project, network, service and env variables
provides:
  - Caddy client-address rule that reads CF-Connecting-IP only, trusted only from the Compose subnet
  - cloudflared Compose service (cloudflare/cloudflared:2026.10.3) with a required tunnel token
  - production stack with no published host port and no pinned network gateway
  - E2E overlay that excludes cloudflared by profile and trusts the run subnet
  - .env.example origin https://hestia.aberrance.app and an empty CLOUDFLARE_TUNNEL_TOKEN
  - E2E spec 20 (client IP, CSP, no CORS or cookies) and a static Vitest test over the ingress files
affects: [09-02, 09-03, 09-04, 09-05]

plan_head_before: 73294aa3edfab1ccaa03b7de1484e0f8b490ede3
plan_head_after: 03bb9caafab85bf3ec0943b6d94955e3db7facbd

actuals:
  tokens: 5758
  tasks: 3
  commits: 3

tech-stack:
  added: [cloudflare/cloudflared 2026.10.3 (container image only; no package added)]
  patterns:
    - "Remotely-managed tunnel: token in the environment, route configured in the Cloudflare dashboard"
    - "Compose profile e2e-excluded keeps a production-only service out of the E2E stack"
    - "Static Vitest checks over Compose and Caddyfile text, with the !reset tag declared as a custom YAML tag"

key-files:
  created:
    - e2e/tests/20-ingress-client-ip-and-csp.spec.ts
    - apps/service/src/ingress-config.test.ts
  modified:
    - docker/Caddyfile
    - docker/docker-compose.yml
    - e2e/docker-compose.e2e.yml
    - e2e/setup/stack.ts
    - .env.example
    - scripts/generate-secrets.sh
    - e2e/tests/21-remove-member.spec.ts (renamed from 20-remove-member.spec.ts, content unchanged)

key-decisions:
  - "Network gateway line removed from the hestia ipam config (D-04 taken literally); the first deploy recreates the network, which 09-02's deploy.sh change and 09-04's runbook cover"
  - "Member-removal journey renumbered 21 so it stays last and number 20 goes to the new ingress spec"
  - "E2E client address is the run network gateway (inside the trusted subnet) when no CF-Connecting-IP is sent, the same single shared per-IP bucket as before"

patterns-established:
  - "Commit scope for ingress and Compose work is docker, for the service test it is service (commitlint scope list is closed)"

requirements-completed: [NET-01, NET-02, NET-03, NET-04, NET-05]

coverage:
  - id: D1
    description: "Caddy takes the client only from CF-Connecting-IP when the peer is in HESTIA_TRUSTED_PROXIES; a spoofed X-Forwarded-For is never the client"
    requirement: NET-03
    verification:
      - kind: e2e
        ref: "e2e/tests/20-ingress-client-ip-and-csp.spec.ts#CF-Connecting-IP names the client and X-Forwarded-For is ignored"
        status: pass
      - kind: e2e
        ref: "e2e/tests/20-ingress-client-ip-and-csp.spec.ts#X-Forwarded-For alone cannot choose the client address"
        status: pass
      - kind: integration
        ref: "caddy adapt of docker/Caddyfile in caddy:2.11.7-alpine"
        status: pass
    human_judgment: false
  - id: D2
    description: "cloudflared service pinned, token required from the environment, loopback metrics, tunnel ready healthcheck, no published port anywhere in production"
    requirement: NET-02
    verification:
      - kind: unit
        ref: "apps/service/src/ingress-config.test.ts#runs a pinned cloudflared that needs the tunnel token and never puts it on a command line"
        status: pass
      - kind: unit
        ref: "apps/service/src/ingress-config.test.ts#publishes no host port from the production stack and pins no network gateway"
        status: pass
      - kind: other
        ref: "docker compose config probes in the Task 2 verify (empty token refused, token copied, no ports, image runs as 65532:65532)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CSP connect-src derives from the origin, GoTrue URLs derive from HESTIA_ORIGIN, no CORS or cookie surface"
    requirement: NET-04
    verification:
      - kind: e2e
        ref: "e2e/tests/20-ingress-client-ip-and-csp.spec.ts#the CSP allows WebSockets to the stack's own host and no CORS or cookie header is sent"
        status: pass
      - kind: unit
        ref: "apps/service/src/ingress-config.test.ts#derives the CSP WebSocket host and GoTrue's URLs from HESTIA_ORIGIN"
        status: pass
    human_judgment: false
  - id: D4
    description: ".env.example ships https://hestia.aberrance.app and an empty token; generate-secrets.sh copies the token and names each missing value"
    requirement: NET-05
    verification:
      - kind: unit
        ref: "apps/service/src/ingress-config.test.ts#ships the new origin and an empty tunnel token in .env.example"
        status: pass
      - kind: other
        ref: "Task 2 verify: generate-secrets.sh runs with nothing set (warns), with everything set (silent), mode 600"
        status: pass
    human_judgment: false
  - id: D5
    description: "Behaviour of the real tunnel and the Cloudflare edge (route, token, edge-set CF-Connecting-IP) cannot be exercised without the owner's Cloudflare account"
    requirement: NET-02
    verification: []
    human_judgment: true
    rationale: "Needs the owner's Cloudflare dashboard and token; 09-04's owner checklist covers it"

duration: 12min
completed: 2026-10-26
status: complete
---

# Phase 09 Plan 01: Cloudflare Tunnel Ingress Summary

**Caddy now identifies the client from Cloudflare's `CF-Connecting-IP` only, trusted only from the Compose subnet, behind a pinned `cloudflared` service with a required token and no published host port, proven on the real E2E stack (3 passed).**

## Performance

- **Duration:** 12 min (the E2E bring-up for the tracer ran 2.7 min)
- **Started:** 2026-10-26T17:41Z
- **Completed:** 2026-10-26T17:53Z
- **Tasks:** 3
- **Files:** 9 changed (2 new, 1 rename)

## Accomplishments

- `docker/Caddyfile`: the global `servers` block holds `trusted_proxies static {$HESTIA_TRUSTED_PROXIES}`, `trusted_proxies_strict` and `client_ip_headers CF-Connecting-IP`; everything from `:8080 {` down is unchanged, and both `reverse_proxy` blocks still send one `X-Forwarded-For {client_ip}`.
- `docker/docker-compose.yml`: caddy loses its `ports` block and the gateway variable, gains `HESTIA_TRUSTED_PROXIES: *subnet`; the `hestia` ipam config keeps only the subnet; a new `cloudflared` service (`cloudflare/cloudflared:2026.10.3`, `TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN:?set in .env}`, `TUNNEL_METRICS: 127.0.0.1:2000`, exec-form `cloudflared tunnel ready` healthcheck, `restart: unless-stopped`, shared logging anchor, `hestia` network).
- `e2e/docker-compose.e2e.yml` and `e2e/setup/stack.ts`: cloudflared excluded by profile `e2e-excluded`, Caddy trusts `${HESTIA_E2E_SUBNET:?}` and publishes its loopback port as a plain `ports:` list, the `HESTIA_E2E_GATEWAY` env line is gone (`reserveSubnet()` still passes `--gateway`), and the generated `.env` carries the placeholder token `e2e-not-a-real-token`.
- `.env.example` / `scripts/generate-secrets.sh`: `HESTIA_ORIGIN=https://hestia.aberrance.app`, an empty `CLOUDFLARE_TUNNEL_TOKEN=`; the script copies the token from the environment and warns on stderr about each value still missing (token, owner email, origin) with a reminder about `BACKUP_DIR`, printing nothing when all are set.
- `e2e/tests/20-ingress-client-ip-and-csp.spec.ts`: three tests (header honoured and `X-Forwarded-For` ignored, `X-Forwarded-For` alone cannot choose the client, CSP host plus no CORS or cookie header). The member-removal journey is now `21-remove-member.spec.ts` (git rename, content unchanged).
- `apps/service/src/ingress-config.test.ts`: eight static checks over both Compose files, the Caddyfile, `.env.example` and the service dependencies; the Compose `!reset` tag is declared as a custom YAML tag so an unknown tag fails the test.

## Task Commits

1. **Task 1 (tracer): client address from CF-Connecting-IP** - `3f45fc6` `feat(docker): resolve the client from CF-Connecting-IP in Caddy`
2. **Task 2: cloudflared, token, origin** - `403fc0b` `feat(docker): run cloudflared with a required tunnel token`
3. **Task 3: static ingress test** - `03bb9ca` `test(service): pin the tunnel, trust and origin configuration`

(The plan's subjects were `feat(ingress): ...` and `test(ingress): ...`; commitlint's closed scope list and 71-character subject limit rejected them, see Deviations.)

## Verification Evidence

- `caddy adapt` in `caddy:2.11.7-alpine` with `HESTIA_TRUSTED_PROXIES=172.16.238.0/24` and `HESTIA_HOST=hestia.aberrance.app` matched all four lines: `"client_ip_headers":["CF-Connecting-IP"]`, `"trusted_proxies":{"ranges":["172.16.238.0/24"],"source":"static"}`, `"trusted_proxies_strict":1` and `connect-src 'self' wss://hestia.aberrance.app;`.
- Playwright, spec 20 on the real stack: `3 passed (2.7m)`; the CA workaround was applied and reverted in the same command (`docker/ca.crt` absent, Dockerfiles and `.dockerignore` equal to HEAD afterwards).
- Merged-config facts (Task 2 verify): base config has `cloudflared` with the token from the environment, `TUNNEL_METRICS` on loopback, a versioned image tag, `CMD cloudflared tunnel ready`, `unless-stopped`, the `hestia` network, no token in `command`, no service with `ports`, an ipam entry with no `gateway`, and caddy trusting `172.16.238.0/24`. The merged E2E config has no `cloudflared`, `ports` only on `caddy` and `db`, Caddy published on `127.0.0.1:<port>`, and Caddy trusting the run subnet. `generate-secrets.sh` writes mode 600, warns (token and owner email) with nothing set, stays silent with everything set; Compose refuses an empty token with an error naming `CLOUDFLARE_TUNNEL_TOKEN`. The pinned image runs as `65532:65532`.
- Vitest: `Tests 8 passed (8)` for `ingress-config.test.ts`; the two mutation probes (a second client header in the Caddyfile, a different origin in `.env.example`) each turned it red and both files were restored byte for byte. ESLint, Prettier, the service and e2e typechecks and `jscpd` (1.13% total, limit 2%) pass.
- Acceptance: the only line giving the token a literal value outside `.planning/` is `e2e/setup/stack.ts` (`e2e-not-a-real-token`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Commit subjects adapted to commitlint**
- **Found during:** Task 1 commit
- **Issue:** The commit-msg hook rejected `feat(ingress): resolve the client from CF-Connecting-IP behind a trusted Compose subnet` (scope `ingress` is not in the closed list `web, service, shared, recurrence, matching, db, e2e, docker`; subject over 71 characters). Hooks are not bypassed.
- **Fix:** Used scope `docker` for Tasks 1 and 2 and `service` for Task 3, with shorter subjects (listed above).
- **Commits:** 3f45fc6, 403fc0b, 03bb9ca

**2. [Rule 3 - Blocking] Supabase images pulled from Docker Hub by digest, tagged locally**
- **Found during:** Task 1 verify (E2E bring-up)
- **Issue:** `docker pull` of `public.ecr.aws/supabase/{gotrue,realtime,postgres}` failed with `error from registry: Data limit exceeded` in this sandbox, so the stack could not start. Only the caddy, cloudflared and node images were cached.
- **Fix:** Confirmed with `docker buildx imagetools inspect` that `docker.io/supabase/<name>:<tag>` has the same index digest as the ECR image for all three (gotrue `c0c25187...`, realtime `002193c9...`, postgres `69429624...`), pulled those by digest and tagged them locally as the `public.ecr.aws/supabase/...` names. No repository file changed; TLS verification untouched.
- **Files modified:** none (local Docker image cache only)

**Total deviations:** 2 auto-fixed (both Rule 3). **Impact:** none on repository content; the commit subjects differ from the plan text.

## Notes for Later Plans

- `docs/testing.md` still names the removal journey by its old number (`20`) and the journey count; 09-04 updates it.
- The network now has no pinned gateway, so on a running host the first deploy recreates the `hestia` network; 09-02's `deploy.sh` change and 09-04's runbook cover this.
- Planner decisions 1 (gateway removed) and 4 (rename to 21) were applied as written.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the `cloudflared` service, which the plan's threat model (T-09-01 to T-09-07, T-09-25) covers.

## Self-Check: PASSED

- Files exist: `e2e/tests/20-ingress-client-ip-and-csp.spec.ts`, `e2e/tests/21-remove-member.spec.ts`, `apps/service/src/ingress-config.test.ts`; `e2e/tests/20-remove-member.spec.ts` is gone.
- Commits `3f45fc6`, `403fc0b`, `03bb9ca` are ancestors of HEAD.
- `git rev-list --count 73294aa..HEAD` before this SUMMARY commit: 3.
