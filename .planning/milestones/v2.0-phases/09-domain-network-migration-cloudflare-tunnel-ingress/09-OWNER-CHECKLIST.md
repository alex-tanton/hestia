# Phase 9 owner checklist

Merging this phase into `main` runs CI and then Deploy on the self-hosted runner, which replaces the old ingress with a Cloudflare Tunnel on `https://hestia.aberrance.app`. These steps happen outside the repository, so no code can do them for you. The steps are numbered 1 to 14 and are meant to be done in order. Steps 1 to 6 gate the merge. The full runbook is the "Cloudflare Tunnel" section of `docs/deployment.md`. Nothing in this file holds a secret value: the token is always written as a placeholder.

## Before merging

1. Cloudflare: the `aberrance.app` zone is active on your Cloudflare account and Zero Trust is enabled.
2. Create the tunnel: Zero Trust, Networks, Tunnels, create a cloudflared tunnel named `hestia`. Copy only the token from the install screen.
3. Add the route (the dashboard calls it a published application; older dashboards say public hostname): `hestia.aberrance.app` to the service `http://caddy:8080`. Point it at Caddy, never at a backend. Check that a proxied DNS record for `hestia` exists in the zone; if the dashboard did not create it, add a proxied CNAME `hestia` to `<tunnel-id>.cfargotunnel.com`.
4. Edit `/srv/hestia/.env` by hand in an editor, never with the token on a command line: set `HESTIA_ORIGIN=https://hestia.aberrance.app` and `CLOUDFLARE_TUNNEL_TOKEN=<token>`. Checks, none of which print the token: `grep -c '^CLOUDFLARE_TUNNEL_TOKEN=.' /srv/hestia/.env` prints 1, `grep '^HESTIA_ORIGIN=' /srv/hestia/.env` prints the new origin, `stat -c %a /srv/hestia/.env` prints 600.
5. Take a backup: `hestia-compose exec -T backup /backup.sh`. Then read what the first deploy does to the network:
   - The removed gateway (D-04, planner decision 1, research Pitfall 3 and A5) changes the `hestia` network's configuration.
   - The deploy's prepare step (09-02) therefore stops every container and recreates the network. The supporting services restart before the backup, and `hestia-service` and `caddy` restart at the switch.
   - The site is down from the recreate until the health gate passes, about a minute.
   - Until that deploy has run, do not run any `hestia-compose up` that names only some services from a checkout of the new code; it would leave the recreate half done.
6. Paste the PR body notes below into the pull request description.

## Merge and first deploy

7. Squash-merge. CI runs on `main`, then Deploy runs on the runner. In its log the prepare step prints `Network hestia Removing`, `Network hestia Removed`, `Network hestia Creating` and `Network hestia Created`; `cloudflared` turns healthy; Caddy no longer publishes a port. If the deploy fails, match the message:
   - `the Supabase services, the backup or the tunnel are not healthy; nothing restarted`: on this first deploy the recreate has already stopped `hestia-service` and `caddy`, so the site stays down until a deploy succeeds. Read `hestia-compose logs --tail 50 cloudflared`, fix `/srv/hestia/.env` (usually the token) and re-run the Deploy run (Actions, Deploy, Re-run all jobs).
   - `could not prepare the containers and the hestia network`, or Compose reporting `has active endpoints` or `is not connected to the network`: the recreate was left half done. Run `hestia-compose down` (named volumes and the backup directory are kept; never add `-v`), then re-run the Deploy run. Its prepare step recreates the network and brings every service back.
8. Run `hestia-compose up -d --wait` so `auth` takes the new origin (a deploy never recreates `auth`). Check, printing only the four URL variables: `docker inspect "$(hestia-compose ps -q auth)" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(API_EXTERNAL_URL|GOTRUE_SITE_URL|GOTRUE_URI_ALLOW_LIST|GOTRUE_JWT_ISSUER)='` shows `https://hestia.aberrance.app` in each.
9. Host checks: `hestia-compose exec -T caddy wget -q -O - http://127.0.0.1:8080/api/health` succeeds, and `docker ps --filter label=com.docker.compose.project=hestia --format '{{.Names}} {{.Ports}}' | grep -c -- '->'` prints 0 (no published port).
10. Public checks, from a machine outside the box:
    - `curl -sSI https://hestia.aberrance.app/`: its `Content-Security-Policy` names `wss://hestia.aberrance.app`, and it has no `access-control-allow-origin` and no `set-cookie`.
    - `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://hestia.aberrance.app/auth/v1/signup` prints 403.
    - The browser console stays free of CSP violations while a list syncs between two devices (WebSocket through the tunnel, assumption A4).
    - `hestia-compose logs hestia-service` shows the owner's public address as `remoteAddress`, not a `172.16.238.x` address.
    - The router has no port forwards.

## After merge

11. Turn off the retired ingress on the host: `sudo tailscale funnel reset`, and uninstall it if nothing else needs it. This is the only place it is named.
12. Reinstall the PWA from `https://hestia.aberrance.app` on every device and turn notifications on again; installed apps and push subscriptions on the old origin are abandoned (D-07).
13. Token rotation, when needed: refresh the token in the dashboard, edit `CLOUDFLARE_TUNNEL_TOKEN` in `/srv/hestia/.env`, then `hestia-compose up -d --wait cloudflared`.
14. Bump the `cloudflared` image tag by hand when you want a newer version (A8: Dependabot may not bump tags inside the Compose file).

## PR body notes

- Ingress: the box is reached only through a remotely-managed Cloudflare Tunnel; the `cloudflared` service is always part of the stack and needs `CLOUDFLARE_TUNNEL_TOKEN`. No container publishes a host port, and the router forwards none.
- Origin (D-07, one-way): `https://hestia.aberrance.app` replaces the old origin with no fallback. Installed PWAs and push subscriptions on the old origin are abandoned.
- Client address: Caddy trusts only the Compose subnet and takes the client from `CF-Connecting-IP` alone; `X-Forwarded-For` from a client is never used.
- Deploy gate: the health check now runs inside the caddy container, and `cloudflared` starts with the supporting services, so a bad token fails the deploy with nothing restarted.
- The first deploy recreates the `hestia` network (the gateway line was removed): every container stops, then the stack comes back; expect about a minute of downtime. Recovery for a half-done recreate is `hestia-compose down` (no `-v`) and a re-run of the Deploy run.
- GoTrue keeps the old origin until it is recreated: run `hestia-compose up -d --wait` once after the first deploy.
- E2E: the member-removal journey is renumbered from 20 to 21 so it stays last; number 20 is the new ingress journey.
- Merge only after steps 1-6 of `.planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-OWNER-CHECKLIST.md`.

## Assumptions and choices

Rows marked **owner-visible choice** were decided without you during planning, and each says how to overrule it.

| Item | Choice | Basis and how to overrule |
| ---- | ------ | ------------------------- |
| Network gateway | The `gateway` line is removed from the `hestia` network (D-04 taken literally), so the first deploy recreates the network | **owner-visible choice** (research open question 1, Pitfall 3). To overrule it, put `gateway: 172.16.238.1` back under the network's `ipam` config in a follow-up pull request before merging; the network is then not recreated. |
| Tunnel in the fail-early start | `cloudflared` starts with `db auth realtime kong backup`, so a bad or revoked token fails a deploy with nothing restarted | **owner-visible choice** (open question 2, D-02). To overrule it, move `cloudflared` out of the supporting-services list in `scripts/deploy.sh` and start it after the health gate, non-fatally. |
| Test-fixture sweep and guard terms | Made-up hosts in test fixtures were swept to `hestia.aberrance.app` (09-03), and the hygiene guard (09-05) also covers the retired network's host suffix | **owner-visible choice** (open question 3). To overrule it, revert the 09-03 commits and drop the extra terms from `scripts/check-repo-hygiene.mjs`. |
| E2E numbering | New ingress spec is `20-`, the removal journey is renamed to `21-remove-member.spec.ts` | **owner-visible choice** (open question 4). To overrule it, rename the spec files back and drop spec 20; the ingress checks then move into spec 08. |
| `cloudflared` pin | `cloudflare/cloudflared:2026.10.3` | Measured to run as non-root `65532:65532`. To use another version, change the tag in `docker/docker-compose.yml` and the pinned tests, and take a backup first; apply with `hestia-compose up -d --wait cloudflared`. |
| Token in `.env.example` | Empty (`CLOUDFLARE_TUNNEL_TOKEN=`), so Compose refuses to run until it is set | **owner-visible choice** (D-02). To overrule it, give the Compose variable a default or a profile in a follow-up pull request. |
| A1 | `cloudflared tunnel ready` is 200 only while an edge connection is active | Confirmed by step 7 (the container turns healthy) and step 10 (the site answers). |
| A2 | The ready check can read healthy while the public hostname fails | Local signal only; step 10's public checks are the end-to-end proof. |
| A3 | The dashboard creates the proxied DNS record when the route is added | Confirmed by step 3; otherwise add the proxied CNAME by hand. |
| A4 | Cloudflare proxies WebSocket upgrades through the tunnel with no extra configuration | Confirmed by step 10's list sync between two devices. |
| A5 | The existing `hestia` network carries a Compose config hash, so the gateway removal recreates it | Confirmed by the `Network hestia Removing` to `Created` lines in step 7; on an older Compose it is a no-op. |
| A6 | Container-IP access from the host works for the seed command in `docs/development.md` | Development only; confirmed the first time a developer seeds a Compose stack. |
| A7 | The deploy runner's user may run `docker compose exec` | It is in the `docker` group and `deploy.sh` already execs into `backup` and `db`; confirmed by step 7's health gate passing. |
| A8 | Dependabot may not bump image tags inside `docker/docker-compose.yml` | Confirmed if no pull request appears for the `cloudflared` tag; bump it by hand (step 14). |
