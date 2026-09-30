import { describe, expect, it } from 'vitest';
import { PILLARS, RELEASED_PILLARS, TABS, activeSubTab, sectionForPath } from './sections.ts';

describe('navigation config', () => {
  it('orders the tab bar Dashboard · Lists · Meals · Bills · Chores', () => {
    expect(TABS.map((tab) => tab.label)).toEqual([
      'Dashboard',
      'Lists',
      'Meals',
      'Bills',
      'Chores',
    ]);
  });

  it('gives each tab exactly the sub-tabs the Design document lists, root first', () => {
    expect(PILLARS.lists.subTabs.map((tab) => tab.label)).toEqual([
      'Lists',
      'Deals',
      'Flyers',
      'Pantry',
    ]);
    expect(PILLARS.meals.subTabs.map((tab) => tab.label)).toEqual([
      'Planner',
      'Recipes',
      'Suggestions',
    ]);
    expect(PILLARS.bills.subTabs.map((tab) => tab.label)).toEqual(['Bills', 'Subscriptions']);
    expect(PILLARS.chores.subTabs.map((tab) => tab.label)).toEqual(['Chores', 'Errands']);
    for (const pillar of Object.values(PILLARS)) {
      expect(pillar.subTabs[0]?.path).toBe(pillar.path);
    }
  });

  it('ships Lists and Meals, so Bills and Chores are still coming soon', () => {
    expect([...RELEASED_PILLARS]).toEqual(['lists', 'meals']);
  });
});

describe('sectionForPath', () => {
  it.each([
    ['/', 'dashboard'],
    ['/lists', 'lists'],
    ['/lists/deals', 'lists'],
    ['/meals/recipes', 'meals'],
    ['/bills/subscriptions', 'bills'],
    ['/chores/errands', 'chores'],
    ['/settings', 'dashboard'],
    ['/listsx', 'dashboard'],
  ])('maps %s to %s', (path, section) => {
    expect(sectionForPath(path)).toBe(section);
  });
});

describe('activeSubTab', () => {
  it('picks the longest matching sub-tab so /lists/deals is Deals, not Lists', () => {
    expect(activeSubTab(PILLARS.lists, '/lists/deals')?.label).toBe('Deals');
    expect(activeSubTab(PILLARS.lists, '/lists/deals/123')?.label).toBe('Deals');
    expect(activeSubTab(PILLARS.lists, '/lists/abc')?.label).toBe('Lists');
    expect(activeSubTab(PILLARS.lists, '/lists')?.label).toBe('Lists');
  });

  it('matches whole path segments only', () => {
    expect(activeSubTab(PILLARS.meals, '/meals/recipesx')?.label).toBe('Planner');
  });
});
