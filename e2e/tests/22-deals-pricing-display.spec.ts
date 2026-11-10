import { expect, test } from '@playwright/test';
import { expectDashboard, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 22: Deals pricing display verification across color schemes (TEST-03, D-05).
 * Validates that deal cards correctly render primary sale price, strikethrough original price,
 * and calculated discount percentage badge, compliant with WCAG 2.1 AA accessibility in both
 * light and dark themes without live network calls.
 */

const TARGETS = {
  light: {
    query: 'pure pumpkin',
    name: 'Harris Teeter 100% Pure Pumpkin',
    salePrice: '$1.67',
    originalPrice: '$1.99',
    badge: '-16%',
  },
  dark: {
    query: 'sargento',
    name: 'Sargento Balanced Breaks',
    salePrice: '$3.49',
    originalPrice: '$3.99',
    badge: '-12%',
  },
} as const;

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 22 — deals pricing display (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('renders sale price, strikethrough regular price, and discount badge with accessibility compliance', async ({
      page,
    }) => {
      const target = TARGETS[theme];

      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      await page.goto('/lists/deals');
      await expect(page.getByRole('heading', { name: 'Deals', level: 1 })).toBeVisible();

      // Search deals using pre-warmed cache query
      await page.getByLabel('Search deals').fill(target.query);
      await page.getByRole('button', { name: 'Search' }).click();

      // Locate target deal card
      const card = page.getByRole('article', { name: new RegExp(target.name) });
      await expect(card).toBeVisible();

      // Assert primary sale price is rendered
      const salePriceElement = card.locator('.text-section').filter({ hasText: target.salePrice });
      await expect(salePriceElement).toBeVisible();

      // Assert strikethrough original price with .line-through styling
      const strikethroughElement = card
        .locator('.line-through')
        .filter({ hasText: target.originalPrice });
      await expect(strikethroughElement).toBeVisible();

      // Assert discount percentage badge
      const badgeElement = card.locator('span').filter({ hasText: target.badge });
      await expect(badgeElement).toBeVisible();

      // Run automated accessibility audit
      await expectAccessible(page, `deal pricing display (${theme})`);
    });
  });
}
