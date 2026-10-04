import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.1 Level AA is the target (Design › Accessibility). */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Axe reads color contrast from computed styles, so a sheet still sliding in or a dialog still
 * fading reports the blend it is passing through rather than the colors it lands on. Waiting for
 * every animation that has an end is the accurate wait; the loading spinner runs forever, so it
 * is left out rather than waited on.
 *
 * A transition exists only from the first style flush after the change that starts it, so a read
 * taken before that flush sees nothing running and would pass mid-transition. The loop therefore
 * only settles once a whole frame has passed with nothing running, and waits on each running
 * animation's own `finished` promise rather than polling for its state.
 */
export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const running = () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity &&
            animation.playState === 'running',
        );
    for (;;) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
      const pending = running();
      if (pending.length === 0) return;
      await Promise.all(pending.map((animation) => animation.finished.catch(() => undefined)));
    }
  });
}

/**
 * Design › Accessibility › Verification: axe-core runs on every screen a journey visits, in both
 * themes. It catches roughly half of real issues, so it stands alongside the manual keyboard and
 * screen-reader passes rather than replacing them.
 */
export async function expectAccessible(page: Page, screen: string): Promise<void> {
  await settleAnimations(page);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} (${violation.impact ?? 'unknown'}) at ${node.target.join(' ')}: ` +
        `${node.failureSummary ?? violation.help} | ${node.html}`,
    ),
  );
  expect(summary, `axe violations on ${screen}`).toEqual([]);
}
