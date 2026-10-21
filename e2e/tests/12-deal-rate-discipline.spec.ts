import { expect, test } from '@playwright/test';
import { expectDashboard, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { flippRequestLines, serviceLogLines, urlOf, type ServiceLogLine } from '../support/logs.ts';
import { SEED } from '../support/env.ts';

/**
 * Rate discipline is observable in logs: one refresh per active postal code, flyer items only for
 * favorited merchants, serialized, backed off on failure.
 *
 * E2E never calls Flipp live: the Compose overlay points hearth-service at the checked-in raw
 * captures instead of `backflipp.wishabi.com` (`e2e/docker-compose.e2e.yml`,
 * `HEARTH_FLIPP_FIXTURE_DIR`), so every "flipp request" log line this run has printed came from the
 * fixture transport.
 *
 * The raw captures only cover 27514: `FlippDealSource.listMerchants` also asks for the active
 * flyers at whatever postal code it is given (it only lists a merchant if it has one), so the
 * earlier journeys' own households genuinely do reach Flipp for 27601 (Rivera Family) and 27705
 * (Empty House) — and genuinely get a real "no data here" 404, exactly as the live endpoint would
 * answer for a location it has nothing for. That is not a fetch this suite failed to avoid; it is
 * the resilience path the wrapper is specified to have, and the discipline this test can actually
 * check is that even that path stays serialized and backs off correctly rather than hammering the
 * endpoint.
 *
 * This runs last, so it also covers everything earlier in the suite: journey 1's onboarding made
 * the one merchants-directory request every run needs, and journey 2's two theme runs searched a
 * warm `deal_query_cache` row each and made no request at all — the proof that a cache-served
 * action never reaches Flipp.
 */

/**
 * Groups log lines by url into calls, each call its attempts in order (1, then 2 and 3 on
 * failure) — the shape one `FlippRequestQueue.request()` leaves in the log.
 */
function callsByUrl(lines: readonly ServiceLogLine[]): Map<string, ServiceLogLine[][]> {
  const calls = new Map<string, ServiceLogLine[][]>();
  for (const line of lines) {
    const url = urlOf(line);
    const forUrl = calls.get(url) ?? [];
    calls.set(url, forUrl);
    if (line['attempt'] === 1 || forUrl.length === 0) forUrl.push([line]);
    else forUrl[forUrl.length - 1]?.push(line);
  }
  return calls;
}

test('deal search and flyer browsing keep the discipline the logs promise', async ({ page }) => {
  const before = flippRequestLines(serviceLogLines());

  // Serialized, whatever the outcome: every request so far waited at least the 500ms minimum gap
  // behind the one before it.
  for (const line of before) {
    const gapMs = line['gapMs'];
    if (gapMs !== null) expect(gapMs as number).toBeGreaterThanOrEqual(500);
  }

  // The merchant directory is one global, postal-code-agnostic request, fetched once no matter how
  // many households' merchants screens the suite has opened by now.
  const merchantsLines = before.filter((line) => urlOf(line) === '/flipp/merchants');
  expect(merchantsLines).toHaveLength(1);
  expect(merchantsLines[0]?.['status']).toBe(200);
  expect(merchantsLines[0]?.['attempt']).toBe(1);

  // No test path anywhere in the suite ever fetches live on a keyword search: every search a
  // journey makes is a warm `deal_query_cache` hit, journey 2's included.
  expect(before.filter((line) => urlOf(line).startsWith('/flipp/items/search'))).toHaveLength(0);

  // A postal code the captures have nothing for backs off correctly rather than hammering Flipp:
  // three attempts, one second then two, then it gives up for that call. Both Rivera Family
  // (27601) and Empty House (27705) are genuinely fetched by earlier journeys' own households —
  // `FlippDealSource.listMerchants` asks for a postal code's active flyers to know which merchants
  // to list — and each of those calls is exactly this shape.
  for (const [url, calls] of callsByUrl(before)) {
    if (url === '/flipp/merchants' || url === '/flipp/flyers?postal_code=27514') continue;
    for (const attempts of calls) {
      expect(attempts.map((line) => line['status'])).toEqual([404, 404, 404]);
      expect(attempts.map((line) => line['attempt'])).toEqual([1, 2, 3]);
    }
  }

  await signIn(page, SEED.alex.email);
  await expectDashboard(page, SEED.oakStreet.name);

  await page.goto('/lists/flyers');
  await expect(page.getByRole('heading', { name: 'Flyers', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /Food Lion/ })).toBeVisible();
  await expectAccessible(page, 'flyers, favorite stores');

  // Oak Street's own postal code, 27514, is the one the captures cover: fetched once, ever, no
  // matter how many members or journeys open its Flyers screen — "no fetch is ever triggered
  // directly by a user action that a cache could serve".
  const FLYERS_URL = '/flipp/flyers?postal_code=27514';
  const afterFirstVisit = flippRequestLines(serviceLogLines());
  const flyersLines = afterFirstVisit.filter((line) => urlOf(line) === FLYERS_URL);
  expect(flyersLines).toHaveLength(1);
  expect(flyersLines[0]?.['status']).toBe(200);
  expect(flyersLines[0]?.['gapMs']).not.toBeNull();
  expect(flyersLines[0]?.['gapMs'] as number).toBeGreaterThanOrEqual(500);

  // A second view within the flyers cache's 12-hour TTL is served from it, not fetched again.
  await page.reload();
  await expect(page.getByRole('link', { name: /Food Lion/ })).toBeVisible();
  const afterSecondVisit = flippRequestLines(serviceLogLines());
  expect(afterSecondVisit.filter((line) => urlOf(line) === FLYERS_URL)).toHaveLength(1);
});
