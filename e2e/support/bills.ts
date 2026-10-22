import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { REPO_ROOT } from './env.ts';

/** The two viewports the journeys check; a screen is checked where it differs. */
export const DESKTOP = { width: 1280, height: 800 } as const;
export const PHONE = { width: 390, height: 844 } as const;

/** A labelled section on the bills dashboard: "Overdue", "This week", or "Later". */
export function group(page: Page, name: string): Locator {
  return page.getByRole('region', { name });
}

/**
 * A full-page screenshot writer for one unit's folder under `shots/`, created on first use. The
 * folder is per unit so a journey's shots never overwrite another's.
 */
export function screenshotsInto(unit: string): (page: Page, name: string) => Promise<void> {
  const dir = join(REPO_ROOT, 'shots', unit);
  mkdirSync(dir, { recursive: true });
  return async (page, name) => {
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
  };
}
