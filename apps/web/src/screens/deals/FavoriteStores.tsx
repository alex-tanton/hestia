import { Store } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { Merchant } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { Sheet } from '../../components/ui/Sheet.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useAddFavoriteStore, useMerchants, useRemoveFavoriteStore } from '../../lib/api/deals.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { DealImage } from './DealImage.tsx';
import { asOfLabel } from './DealFreshness.tsx';

export const FAVORITES_OFFLINE_MESSAGE =
  'Choosing stores needs a connection. Your lists still work.';

/** Design › Deals-specific states: "No stores found near \[ZIP\]" plus a way to change it. */
export function noStoresMessage(postalCode: string | undefined): string {
  return postalCode === undefined
    ? 'No stores found near this household.'
    : `No stores found near ${postalCode}.`;
}

export interface FavoriteStoresProps {
  /** Undefined while the profile is still loading, as in onboarding's setup step. */
  householdId: string | undefined;
  /** Named in the empty state, so the ZIP that found nothing is visible. */
  postalCode?: string | undefined;
  /** Sends the member to Household settings, where the postal code is changed. */
  showPostalCodeAction?: boolean;
}

/**
 * The household's favorite stores, chosen from the merchants with an active flyer near its postal
 * code. Any member may edit them (Design › Screens › 4), and they scope the default deal search,
 * the flyer list, and the daily refresh (Requirements › Data model, "Deals").
 *
 * Changing a favorite is not a queueable write, so the controls are disabled offline with the
 * reason beside them rather than hidden (Design › Offline rules).
 */
export function FavoriteStores({
  householdId,
  postalCode,
  showPostalCodeAction = true,
}: FavoriteStoresProps): ReactElement {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const merchants = useMerchants(isOnline ? householdId : undefined);
  // Hooks run unconditionally; with no household id the query above is disabled and the skeleton
  // below returns first, so neither mutation can be called with an empty path.
  const addFavorite = useAddFavoriteStore(householdId ?? '');
  const removeFavorite = useRemoveFavoriteStore(householdId ?? '');
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState<string>();

  if (!isOnline) return <OfflineState message={FAVORITES_OFFLINE_MESSAGE} />;
  if (householdId === undefined || merchants.isPending) {
    return <SkeletonRows label="Loading stores" rows={4} />;
  }
  if (merchants.isError) {
    return (
      <ErrorState
        message="Couldn't load the stores near this household. Try again."
        onRetry={() => {
          void merchants.refetch();
        }}
      />
    );
  }

  const toggle = (merchant: Merchant, isFavorite: boolean): void => {
    setError(undefined);
    setPendingId(merchant.merchantId);
    const done = {
      onError: (cause: unknown) => {
        setError(userMessage(cause, { fallback: `Could not change ${merchant.name}. Try again.` }));
      },
      onSettled: () => {
        setPendingId(undefined);
      },
    };
    if (isFavorite) {
      addFavorite.mutate({ merchantId: merchant.merchantId, merchantName: merchant.name }, done);
    } else {
      removeFavorite.mutate(merchant.merchantId, done);
    }
  };

  const { merchants: rows, asOf, stale } = merchants.data;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Store}
        message={noStoresMessage(postalCode)}
        {...(showPostalCodeAction
          ? {
              action: {
                label: 'Change the postal code',
                onAction: () => {
                  void navigate('/settings');
                },
              },
            }
          : {})}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {stale && asOf !== null && <p className="text-caption text-muted">{asOfLabel(asOf)}</p>}
      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((merchant) => (
          <li key={merchant.merchantId}>
            <Checkbox
              variant="in-list"
              checked={merchant.isFavorite}
              disabled={pendingId === merchant.merchantId}
              label={merchant.name}
              detail={<DealImage url={merchant.logoUrl} className="size-8" />}
              onChange={(event) => {
                toggle(merchant, event.target.checked);
              }}
            />
          </li>
        ))}
      </ul>
      <FormMessage message={error} />
    </div>
  );
}

export interface FavoriteStoresPanelProps extends FavoriteStoresProps {
  /** Onboarding's step closes with its own action; Settings has none. */
  onDone?: () => void;
}

/**
 * Design › Deals-specific states, "Household has no favorite stores": prompt to pick favorites,
 * with browse-all already working — which it is, because the service shows a household with no
 * favorites every merchant rather than nothing.
 */
export function FavoritesPrompt({ householdId, postalCode }: FavoriteStoresProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-border bg-section-tint p-3">
      <p className="flex items-start gap-2 text-body-sm text-secondary">
        <Store
          aria-hidden
          size={20}
          strokeWidth={1.5}
          className="mt-px shrink-0 text-section-accent"
        />
        <span className="max-w-[70ch]">No favorite stores yet. Showing every store near you.</span>
      </p>
      <Button
        variant="secondary"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Choose favorite stores
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen} title="Favorite stores">
        <div className="px-4">
          <FavoriteStoresPanel householdId={householdId} postalCode={postalCode} />
        </div>
      </Sheet>
    </div>
  );
}

/** The picker with its explanation, as onboarding and Settings both show it. */
export function FavoriteStoresPanel({ onDone, ...props }: FavoriteStoresPanelProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[70ch] text-body text-secondary">
        Pick the stores you shop at. Deals and flyers start with these, and you can browse every
        store near you at any time.
      </p>
      <FavoriteStores {...props} />
      {/* Continuing is navigation, not a write, so it stays available offline — the picker above
          is what carries the offline explanation. */}
      {onDone && (
        <Button className="self-start" onClick={onDone}>
          Continue
        </Button>
      )}
    </div>
  );
}
