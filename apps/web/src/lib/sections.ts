export type SectionId = 'dashboard' | 'lists' | 'meals' | 'bills' | 'chores';
export type PillarId = Exclude<SectionId, 'dashboard'>;

export interface SubTab {
  label: string;
  path: string;
}

export interface Tab {
  id: SectionId;
  label: string;
  path: string;
}

export interface Pillar extends Tab {
  id: PillarId;
  /** The first entry is the tab's root. */
  subTabs: readonly SubTab[];
}

export const DASHBOARD_TAB: Tab = {
  id: 'dashboard',
  label: 'Dashboard',
  path: '/',
};

export const PILLARS: Readonly<Record<PillarId, Pillar>> = {
  lists: {
    id: 'lists',
    label: 'Lists',
    path: '/lists',
    subTabs: [
      { label: 'Lists', path: '/lists' },
      { label: 'Deals', path: '/lists/deals' },
      { label: 'Flyers', path: '/lists/flyers' },
      { label: 'Pantry', path: '/lists/pantry' },
    ],
  },
  meals: {
    id: 'meals',
    label: 'Meals',
    path: '/meals',
    subTabs: [
      { label: 'Planner', path: '/meals' },
      { label: 'Recipes', path: '/meals/recipes' },
    ],
  },
  bills: {
    id: 'bills',
    label: 'Bills',
    path: '/bills',
    subTabs: [
      { label: 'Bills', path: '/bills' },
      { label: 'Subscriptions', path: '/bills/subscriptions' },
    ],
  },
  chores: {
    id: 'chores',
    label: 'Chores',
    path: '/chores',
    subTabs: [
      { label: 'Chores', path: '/chores' },
      { label: 'Errands', path: '/chores/errands' },
    ],
  },
};

/** Bottom tab bar order. */
export const TABS: readonly Tab[] = [
  DASHBOARD_TAB,
  PILLARS.lists,
  PILLARS.meals,
  PILLARS.bills,
  PILLARS.chores,
];

/**
 * Pillars whose screens have shipped. Everything else renders the coming-soon state; each
 * pillar's phase adds itself here (Lists in Phase 2, Meals in Phase 3, Bills and Chores in 4).
 */
export const RELEASED_PILLARS: ReadonlySet<PillarId> = new Set<PillarId>([
  'lists',
  'meals',
  'chores',
  'bills',
]);

/** The section that owns a pathname. Settings and unknown paths are section-neutral. */
export function sectionForPath(pathname: string): SectionId {
  const first = pathname.split('/')[1] ?? '';
  return first in PILLARS ? (first as PillarId) : 'dashboard';
}

/** The sub-tab a pathname sits under: the longest sub-tab path that prefixes it. */
export function activeSubTab(pillar: Pillar, pathname: string): SubTab | undefined {
  return pillar.subTabs
    .filter((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`))
    .reduce<SubTab | undefined>(
      (best, tab) => (best && best.path.length >= tab.path.length ? best : tab),
      undefined,
    );
}
