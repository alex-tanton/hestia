import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { Merchant } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { Sheet } from '../../components/ui/Sheet.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { MdFilterChip } from '../../components/md/MdFilterChip.tsx';
import { MdDialog } from '../../components/md/MdDialog.tsx';
import { useAddFavoriteStore, useMerchants, useRemoveFavoriteStore } from '../../lib/api/deals.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { DealImage } from './DealImage.tsx';
import { asOfLabel } from './DealFreshness.tsx';

export const FAVORITES_OFFLINE_MESSAGE =
  'Choosing stores needs a connection. Your lists still work.';

/** "No stores found near [ZIP]" plus a way to change it. */
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
  /** Display mode: chips with dialog picker (Settings default) or list of checkboxes (onboarding). */
  variant?: 'chips' | 'list';
}

/**
 * The household's favorite stores, displayed as removable MdFilterChip pills with an md-list
 * store picker dialog per D-18.
 */
export function FavoriteStores({
  householdId,
  postalCode,
  showPostalCodeAction = true,
  variant = 'chips',
}: FavoriteStoresProps): ReactElement {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const merchants = useMerchants(isOnline ? householdId : undefined);
  const addFavorite = useAddFavoriteStore(householdId ?? '');
  const removeFavorite = useRemoveFavoriteStore(householdId ?? '');
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState<string>();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

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

  const handleAdd = (merchant: Merchant): void => {
    setError(undefined);
    setPendingId(merchant.merchantId);
    addFavorite.mutate(
      { merchantId: merchant.merchantId, merchantName: merchant.name },
      {
        onError: (cause: unknown) => {
          setError(userMessage(cause, { fallback: `Could not add ${merchant.name}. Try again.` }));
        },
        onSettled: () => {
          setPendingId(undefined);
          setIsPickerOpen(false);
        },
      },
    );
  };

  const handleRemove = (merchant: Merchant): void => {
    setError(undefined);
    setPendingId(merchant.merchantId);
    removeFavorite.mutate(merchant.merchantId, {
      onError: (cause: unknown) => {
        setError(userMessage(cause, { fallback: `Could not remove ${merchant.name}. Try again.` }));
      },
      onSettled: () => {
        setPendingId(undefined);
      },
    });
  };

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
        icon="storefront"
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

  if (variant === 'list') {
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

  const favoriteMerchants = rows.filter((m) => m.isFavorite);
  const availableMerchants = rows.filter((m) => !m.isFavorite);
  const filteredAvailable = availableMerchants.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3">
      {stale && asOf !== null && <p className="text-caption text-muted">{asOfLabel(asOf)}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {favoriteMerchants.map((merchant) => (
          <div key={merchant.merchantId} className="inline-flex items-center gap-1">
            <MdFilterChip
              selected
              removable
              disabled={pendingId === merchant.merchantId}
              onRemove={() => {
                handleRemove(merchant);
              }}
              aria-label={`Remove ${merchant.name} from favorites`}
            >
              {merchant.name}
            </MdFilterChip>
            <button
              type="button"
              className="sr-only"
              aria-label={`Remove ${merchant.name} from favorites`}
              disabled={pendingId === merchant.merchantId}
              onClick={() => {
                handleRemove(merchant);
              }}
            >
              Remove {merchant.name} from favorites
            </button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="rounded-full"
          aria-label="Add favorite store"
          onClick={() => {
            setIsPickerOpen(true);
          }}
        >
          <Icon name="add" size={18} />
          Add store
        </Button>
      </div>

      <FormMessage message={error} />

      <MdDialog
        open={isPickerOpen}
        quick
        role="dialog"
        aria-label="Add favorite store"
        className="w-full max-w-[500px]"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsPickerOpen(false);
        }}
      >
        <div slot="headline" className="text-title-large">
          Add favorite store
        </div>
        <div slot="content" className="flex flex-col gap-3 pt-2">
          <TextField
            label="Search stores"
            placeholder="Search stores near you..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
          <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)] max-h-60 overflow-y-auto">
            {filteredAvailable.map((merchant) => (
              <li key={merchant.merchantId}>
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors"
                  onClick={() => {
                    handleAdd(merchant);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <DealImage url={merchant.logoUrl} className="size-8" />
                    <span className="text-body font-medium">{merchant.name}</span>
                  </div>
                  <Icon name="add" size={20} />
                </button>
              </li>
            ))}
            {filteredAvailable.length === 0 && (
              <li className="py-4 text-center text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
                {availableMerchants.length === 0
                  ? 'All available regional stores are already in your favorites.'
                  : 'No stores match your search.'}
              </li>
            )}
          </ul>
        </div>
        <div slot="actions">
          <Button
            variant="ghost"
            onClick={() => {
              setIsPickerOpen(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </MdDialog>
    </div>
  );
}

export interface FavoriteStoresPanelProps extends FavoriteStoresProps {
  onDone?: () => void;
}

/**
 * A household with no favorite stores: prompt to pick favorites.
 */
export function FavoritesPrompt({ householdId, postalCode }: FavoriteStoresProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-border bg-section-tint p-3">
      <p className="flex items-start gap-2 text-body-sm text-secondary">
        <Icon name="storefront" size={20} className="mt-px shrink-0 text-section-accent" />
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
export function FavoriteStoresPanel({
  onDone,
  variant = 'list',
  ...props
}: FavoriteStoresPanelProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[70ch] text-body text-secondary">
        Pick the stores you shop at. Deals and flyers start with these, and you can browse every
        store near you at any time.
      </p>
      <FavoriteStores variant={variant} {...props} />
      {onDone && (
        <Button className="self-start" onClick={onDone}>
          Continue
        </Button>
      )}
    </div>
  );
}
