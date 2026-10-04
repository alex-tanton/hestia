import {
  ClipboardCheck,
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

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
  icon: LucideIcon;
}

export interface Pillar extends Tab {
  id: PillarId;
  /** Design › Staged releases: the one line the coming-soon state shows. */
  comingSoon: string;
  /** Design › Layout shell › Sub-tabs; the first entry is the tab's root. */
  subTabs: readonly SubTab[];
}

export const DASHBOARD_TAB: Tab = {
  id: 'dashboard',
  label: 'Dashboard',
  path: '/',
  icon: LayoutDashboard,
};

export const PILLARS: Readonly<Record<PillarId, Pillar>> = {
  lists: {
    id: 'lists',
    label: 'Lists',
    path: '/lists',
    icon: ShoppingCart,
    comingSoon: "Shared shopping lists built from this week's deals at your stores.",
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
    icon: UtensilsCrossed,
    comingSoon: "Plan the week's meals around what's on sale and in your pantry.",
    subTabs: [
      { label: 'Planner', path: '/meals' },
      { label: 'Recipes', path: '/meals/recipes' },
      { label: 'Suggestions', path: '/meals/suggestions' },
    ],
  },
  bills: {
    id: 'bills',
    label: 'Bills',
    path: '/bills',
    icon: Receipt,
    comingSoon: 'Track bills and subscriptions and see what is due each week.',
    subTabs: [
      { label: 'Bills', path: '/bills' },
      { label: 'Subscriptions', path: '/bills/subscriptions' },
    ],
  },
  chores: {
    id: 'chores',
    label: 'Chores',
    path: '/chores',
    icon: ClipboardCheck,
    comingSoon: 'Keep recurring chores and one-off errands on a shared schedule.',
    subTabs: [
      { label: 'Chores', path: '/chores' },
      { label: 'Errands', path: '/chores/errands' },
    ],
  },
};

/** Bottom tab bar order (PRD › Navigation shell). */
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
