---
phase: 09-domain-network-migration-cloudflare-tunnel-ingress
reviewed: 2026-10-26T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - docker/Caddyfile
  - docker/caddy-entrypoint.sh
  - docker/docker-compose.yml
  - e2e/docker-compose.e2e.yml
  - e2e/setup/stack.ts
  - e2e/tests/20-ingress-client-ip-and-csp.spec.ts
  - .env.example
  - scripts/deploy.sh
  - scripts/deploy.test.mjs
  - scripts/caddy-entrypoint.test.mjs
  - scripts/check-repo-hygiene.mjs
  - scripts/check-repo-hygiene.test.mjs
  - scripts/ci-prepull-images.sh
  - scripts/ci-prepull-images.test.mjs
  - scripts/generate-secrets.sh
  - apps/service/src/ingress-config.test.ts
  - apps/service/src/env.ts
  - apps/service/src/env.test.ts
  - apps/service/src/test/fake-app.ts
  - apps/service/src/cli.test.ts
  - package.json
  - docs/deployment.md
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-26
**Depth:** standard
**Files Reviewed:** 22 (diff `73294aa..HEAD`, source, config and scripts; `.planning/` skipped)
**Status:** issues_found

## Summary

The trust model is implemented as stated. In `docker/Caddyfile`, `client_ip_headers` names only
`CF-Connecting-IP`. The trust list comes from `HESTIA_TRUSTED_PROXIES`, which is the Compose subnet.
`HESTIA_HOST_GATEWAY` is gone from all three files. No service in `docker/docker-compose.yml` has a
`ports:` key. The token reaches `cloudflared` only through `TUNNEL_TOKEN`, as `${CLOUDFLARE_TUNNEL_TOKEN:?set in .env}`.
It is not in `command`, not in `hestia-service`'s environment, and not in the deploy log. `docker compose config`
resolves cleanly with the token set. The new tests pass: `ingress-config` 8/8, and 57/57 across
`caddy-entrypoint`, `deploy`, `check-repo-hygiene` and `ci-prepull-images`. `check-repo-hygiene` is clean on HEAD.

No security vulnerability or data-loss bug was found. The six warnings are:

- **Rollback:** the automatic rollback cannot work across this phase's boundary.
- **Failure handling:** `deploy.sh` can leave production down while it reports "nothing restarted".
- **Redeploys:** a deploy can never roll out a `cloudflared` change.
- **Test pins:** three tests are weaker than their descriptions claim.

## Warnings

### WR-01: Automatic rollback on the first deploy of this phase cannot succeed

**File:** `scripts/deploy.sh:58-63` (`switch_to`), `docker/docker-compose.yml:244-249`
**Issue:** The rollback target is the previously running `hestia-caddy` image. At `73294aa` that
image bakes in a Caddyfile with `trusted_proxies static 127.0.0.1/32 ::1/128 {$HESTIA_HOST_GATEWAY}/32`.
The Compose file no longer sets `HESTIA_HOST_GATEWAY`, so the old image sees `/32`, which is an invalid CIDR.
Caddy refuses to start, so `healthy_within` fails after the rollback as well. The old stack also
depended on the `127.0.0.1:8080` published port, which no longer exists. The result is the worst
outcome the script has: "rolled back, but the previous images are not healthy either". `docs/deployment.md`
(Troubleshooting, "Failed deploy / automatic rollback") describes the rollback as generally working and does
not mention this one-time gap.
**Fix:** Document that the first deploy on the tunnel ingress has no working automatic rollback, and
that recovery is a fix-forward redeploy. Alternatively make the rollback self-contained. Pass the old
variable only for the rollback (`HESTIA_HOST_GATEWAY=172.16.238.1 compose up ...` does not help, since the
variable is not interpolated), or skip rollback and say so when `revision_of` shows the previous
image predates the ingress change. At minimum the "first deploy" section in `docs/deployment.md` should say
so, and the deploy should log it.

### WR-02: A failure after the network recreate leaves production down while every message says "nothing restarted"

**File:** `scripts/deploy.sh:93-101` (and the `fail` messages at 101, 114, 118, 124)
**Issue:** On the first deploy, `up --no-start` stops every container. If the script then dies in the
fail-early start (bad token), the backup, the migration or the login step, `hestia-service` and `caddy`
stay stopped, and nothing restarts them. The script has no EXIT trap and no recovery. The messages
still say `nothing restarted`, which is false for this deploy, and misleading for the operator reading
CI logs. The header comment and the docs mention the exception, but the runtime output does not.
**Fix:** Track whether the prepare step actually recreated the network, for example by capturing the
`up --no-start` output and matching `Network .* Removed`. On any later `fail`, restart the two
containers on `:current` with `switch_to "$prev_service" "$prev_caddy"` when a previous image exists. If
that is not wanted, make the messages say what is true: `fail "...; hestia-service and caddy are stopped until a deploy succeeds"`.

### WR-03: A deploy never recreates `cloudflared`, so a Dependabot bump or a rotated token silently does not apply

**File:** `scripts/deploy.sh:100`, `docker/docker-compose.yml:261`
**Issue:** `compose up --detach --wait --no-recreate ... cloudflared` leaves the running connector as is.
`.github/dependabot.yml` covers `/docker` for the `docker` ecosystem, which includes the pinned
`cloudflare/cloudflared:2026.10.3` line. A merged bump passes CI and the deploy "succeeds", but the old
connector keeps running, with no signal anywhere. The same applies to any other change to the
`cloudflared` service definition. The docs say a deploy never recreates it, so this is documented,
but nothing detects the drift. It is a security-relevant component, since the connector is the whole
ingress.
**Fix:** Either recreate `cloudflared` when its definition changed, which is cheap and only drops the
tunnel for seconds: run `compose up --detach --wait --no-build cloudflared` without `--no-recreate`, since Compose
recreates only on a config or image change. Or make the deploy log a warning when the running container's
image differs from the Compose file's.

### WR-04: The "trusts only the Compose subnet" test pins a substring, so a widened trust list still passes

**File:** `apps/service/src/ingress-config.test.ts:121`
**Issue:** `expect(globalBlock).toContain('trusted_proxies static {$HESTIA_TRUSTED_PROXIES}')` is a
substring check. Changing the Caddyfile line to `trusted_proxies static {$HESTIA_TRUSTED_PROXIES} 0.0.0.0/0`
(or `private_ranges`) still passes. The test is titled "trusts only the Compose subnet in Caddy" and is the
only static guard on the most security-relevant line of the phase. The `client_ip_headers` assertion
next to it is correctly exact.
**Fix:** Match the whole directive line:
```ts
expect(
  [...globalBlock.matchAll(/^\s*trusted_proxies\s+static\s+(.+?)\s*$/gm)].map((m) => m[1]),
).toEqual(['{$HESTIA_TRUSTED_PROXIES}']);
```

### WR-05: Nothing tests the central claim that a peer outside the trusted subnet cannot name the client

**File:** `e2e/tests/20-ingress-client-ip-and-csp.spec.ts:36-61`, `e2e/docker-compose.e2e.yml:24-31`
**Issue:** Every E2E request reaches Caddy from the run network's gateway, which is inside the trusted
subnet. The spec therefore proves the positive case (a trusted hop's `CF-Connecting-IP` is honoured) and
that `X-Forwarded-For` is ignored. It cannot show that an untrusted peer's `CF-Connecting-IP` is
ignored, which is the property that stops a visitor from picking their own rate-limit bucket. The
static test only compares strings. Dropping `trusted_proxies` entirely would be caught by spec 20's first
test, but narrowing or mis-wiring the trust list in a way that keeps the gateway trusted would not.
**Fix:** Add a small harness or E2E case that starts a second container outside the trusted CIDR on a
different network (or use `docker run --network host` against the published port, with the trust list
set to a CIDR that excludes the connecting address). It would send `CF-Connecting-IP` and assert that the
service logs the connection address instead. If that is too heavy, say plainly in `docs/testing.md` that this
property is not covered, rather than saying the running behaviour is proven.

### WR-06: The new deploy tests cover only the happy path of the new sequencing

**File:** `scripts/deploy.test.mjs:190-249`
**Issue:** The tests assert the order of the prepare, start, backup and restart calls and that health
is checked in the container. They do not exercise any of the new failure branches: (a) `up --no-start`
failing aborts before the start, (b) a failing or unhealthy `cloudflared` aborts before the backup, which is the
property the comment at `deploy.sh:96-99` promises ("fails the deploy before anything is backed up,
migrated or restarted"), and (c) the health gate failing and the rollback calling `exec ... wget` again.
The stub can already be made to fail per call. The "fail-early tunnel" guarantee is therefore
unpinned, and WR-01 and WR-02 would not have been caught.
**Fix:** Add cases with a stub mode that fails a chosen `docker` subcommand. Assert a non-zero exit, that
no `/backup.sh`, `migration up` or `up --detach --no-deps` call was logged, and the failure message.
Add one case where `exec wget` always fails and assert that `switch_to` runs twice.

## Info

### IN-01: A missing or empty tunnel token surfaces as "build failed; nothing restarted"

**File:** `scripts/deploy.sh:82`, `docker/docker-compose.yml:267`
**Issue:** `${CLOUDFLARE_TUNNEL_TOKEN:?set in .env}` is interpolated by every `compose` call, so the first
call, `compose build`, aborts with Compose's own message. The deploy then reports `build failed`, which
points the operator at the wrong place. The docs also say "Compose refuses every command while it is
empty", so `hestia-compose logs` and `ps` fail too, exactly when the owner is trying to diagnose.
**Fix:** Preflight right after the env-file readability check:
`[[ -n "$(env_value CLOUDFLARE_TUNNEL_TOKEN)" ]] || fail "CLOUDFLARE_TUNNEL_TOKEN is empty in $env_file"`.

### IN-02: `ts.net` as a plain substring will flag unrelated text

**File:** `scripts/check-repo-hygiene.mjs:96`
**Issue:** The terms are matched with `git grep -i -F`, so `ts.net` also matches `assets.netlify.app`,
`events.net`, `results.net`, and a sentence that ends in "...ports.Network". `funnel` likewise matches
any English use. The only escape is the one pinned recurrence quote or rewording. The gate then fails
CI with a message that does not say why, and `RETIRED_INGRESS_ALLOWLIST` is deliberately closed.
**Fix:** Use a boundary-aware term for the suffix, for example `.ts.net`, which `-F` can match, or
`\bts\.net\b` with `git grep -E -w`. Keep the other three terms as they are. Add a test that
`assets.netlify.app` passes.

### IN-03: `caddy-entrypoint.sh` accepts origins and trust lists that Caddy will mis-handle

**File:** `docker/caddy-entrypoint.sh:7-22`
**Issue:** `https://` (empty host) and `https://host/path` both pass the `https://*` case. `HESTIA_HOST` then
becomes empty or `host/path`, which silently breaks the CSP `connect-src wss://...`. `HESTIA_TRUSTED_PROXIES`
is checked only for emptiness, so a whitespace-only value passes. The new test does not cover these either.
The "refuses an origin that is not https" test asserts `stderr.includes(ORIGIN)`, which is the example
text inside the message and not the rejected value, so rewording the message would break the test for no
behavioural reason.
**Fix:** Require a non-empty host with no `/`, for example `case "$host" in ''|*/*) fail ;; esac`
after stripping the optional trailing slash, and trim the trust list before the emptiness test. In the test,
assert on the `(got '...')` part of the message.

### IN-04: The real production hostname is now the fixture in unit tests

**File:** `apps/service/src/test/fake-app.ts:20`, `apps/service/src/env.test.ts`, `apps/service/src/cli.test.ts`, `packages/shared/src/scrub.test.ts`, `apps/web/src/screens/settings/settings.test.tsx`
**Issue:** `TEST_ORIGIN` and the other fixtures were `*.ts.net` placeholders. They are now
`https://hestia.aberrance.app`, the live origin. Nothing dials these, but a test that ever runs
a real fetch, or a copied fixture, would target production. The hygiene gate forced the rename, so
the replacement should be a reserved name.
**Fix:** Use `https://hestia.example.test` (or `.example`) in tests. Keep the real hostname only in
`.env.example`, the docs and the `ingress-config` assertions about them.

### IN-05: The trust list is the whole `/24`, and `cloudflared` shares a network with the database

**File:** `docker/docker-compose.yml:249`, `docker/Caddyfile:11`, `docker/docker-compose.yml:264`
**Issue:** Caddy trusts every address on the Compose subnet to name the client, not only the connector's.
Any container on that network (`kong`, `auth`, `realtime`, `backup`, and `hestia-service`, which fetches
user-supplied recipe URLs) is a trusted `CF-Connecting-IP` source. The recipe-URL fetch has a
private-address guard and cannot set request headers, so this is not exploitable today. The connector can also
reach `db:5432` and `auth:9999` directly, so a wrong dashboard route (the one place the repository cannot
constrain) bypasses Caddy's 403 on `/auth/v1/signup`. `docs/deployment.md` warns against it.
**Fix:** Optional hardening. Give `cloudflared` and `caddy` a dedicated `ingress` network with a fixed
`ipv4_address` for the connector, and trust only that address. The `ingress-config` test would then pin
a `/32`.

## Notes

- `scripts/generate-secrets.sh` copies `CLOUDFLARE_TUNNEL_TOKEN` from the environment into `.env`
  unescaped, as it does for the other copied keys. A value containing a newline would add a line to the file.
  Tunnel tokens are base64, so this is theoretical.
- The `!override` removal on the E2E Caddy `ports` is correct because the base no longer publishes one.
  The `profiles: [e2e-excluded]` exclusion and the placeholder token work: `docker compose config` of the base
  file resolves, and the overlay test asserts the profile.

---

_Reviewed: 2026-10-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
