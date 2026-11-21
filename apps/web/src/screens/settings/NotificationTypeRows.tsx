import { useId, type ReactElement } from 'react';
import {
  householdNotificationType,
  type NotificationPreference,
  type ProfileResponse,
} from '@hestia/shared';
import { Card } from '../../components/ui/Card.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { Switch } from '../../components/ui/Switch.tsx';
import { EmptyState } from '../../components/states/StateBlocks.tsx';
import { IOS_INSTALL_MESSAGE } from '../onboarding/InstallStep.tsx';
import {
  BROWSER_SETTINGS_HELP_LABEL,
  BROWSER_SETTINGS_HELP_URL,
  DEVICE_MESSAGES,
  NOTIFICATION_TYPE_COPY,
  NOTIFICATION_TYPES_EMPTY,
  UNSUPPORTED_MESSAGE,
  WEEKLY_NUDGE_HINT,
  WRITE_NEEDS_CONNECTION,
  weeklyNudgeLabel,
} from './notification-copy.ts';

/** Why this device will not receive a type yet; `undefined` when nothing needs saying. */
export type DeviceNote = keyof typeof DEVICE_MESSAGES;

/** One toggle: its name, what it does, and whether it can be changed right now. */
export function PreferenceRow({
  label,
  hint,
  checked,
  isOnline,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  isOnline: boolean;
  onChange: (enabled: boolean) => void;
}): ReactElement {
  const hintId = useId();
  const reasonId = useId();
  const describedBy = isOnline ? hintId : `${hintId} ${reasonId}`;
  return (
    <div className="flex flex-col gap-1">
      <Switch
        label={label}
        checked={checked}
        disabled={!isOnline}
        aria-describedby={describedBy}
        onCheckedChange={onChange}
      />
      <p id={hintId} className="pl-9 text-body-sm text-secondary">
        {hint}
      </p>
      {!isOnline && (
        <p id={reasonId} className="pl-9 text-body-sm text-secondary">
          {WRITE_NEEDS_CONNECTION}
        </p>
      )}
    </div>
  );
}

function copyFor(
  preference: NotificationPreference,
  profile: ProfileResponse,
): { label: string; hint: string } {
  if (preference.type !== householdNotificationType) return NOTIFICATION_TYPE_COPY[preference.type];
  const household = profile.memberships.find((m) => m.householdId === preference.householdId);
  return {
    label: weeklyNudgeLabel(household?.name ?? 'your household'),
    hint: WEEKLY_NUDGE_HINT,
  };
}

const PILLARS: readonly { title: string; types: readonly string[] }[] = [
  {
    title: 'Bills',
    types: ['bill_due'],
  },
  {
    title: 'Chores',
    types: ['chore_due', 'chore_rotation'],
  },
  {
    title: 'Deals & Flyers',
    types: ['flyer_refresh'],
  },
  {
    title: 'Meals & Recipes',
    types: ['meal_reminder', 'weekly_meal_nudge'],
  },
  {
    title: 'Lists',
    types: ['list_activity'],
  },
];

/** The toggles, grouped cleanly by pillar in tonal cards. */
export function PreferenceList({
  preferences,
  profile,
  isOnline,
  onToggle,
}: {
  preferences: NotificationPreference[];
  profile: ProfileResponse;
  isOnline: boolean;
  onToggle: (preference: NotificationPreference, enabled: boolean) => void;
}): ReactElement {
  if (preferences.length === 0) {
    return <EmptyState icon="notifications" message={NOTIFICATION_TYPES_EMPTY} />;
  }

  const grouped = PILLARS.map((pillar) => ({
    title: pillar.title,
    items: preferences.filter((pref) => pillar.types.includes(pref.type)),
  })).filter((group) => group.items.length > 0);

  const knownTypes = PILLARS.flatMap((p) => p.types);
  const others = preferences.filter((pref) => !knownTypes.includes(pref.type));
  if (others.length > 0) {
    grouped.push({ title: 'Other alerts', items: others });
  }

  return (
    <div className="flex flex-col gap-4">
      {grouped.map((group) => (
        <Card key={group.title} variant="flat" className="flex flex-col gap-3">
          <h4 className="text-title-sm font-semibold text-[var(--md-sys-color-on-surface)]">
            {group.title}
          </h4>
          <ul className="flex flex-col gap-4">
            {group.items.map((preference) => {
              const key = `${preference.type}:${preference.householdId ?? ''}`;
              const copy = copyFor(preference, profile);
              return (
                <li key={key}>
                  <PreferenceRow
                    label={copy.label}
                    hint={copy.hint}
                    checked={preference.enabled}
                    isOnline={isOnline}
                    onChange={(enabled) => {
                      onToggle(preference, enabled);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/** A note about this device, in words, beside the toggles. */
export function DeviceNoteLine({ note }: { note: DeviceNote }): ReactElement {
  return (
    <p className="flex items-start gap-2 text-body-sm text-secondary">
      <Icon name="warning" size={20} className="mt-px shrink-0" />
      <span className="max-w-[70ch]">
        {DEVICE_MESSAGES[note]}
        {note === 'denied' && (
          <>
            {' '}
            <a
              href={BROWSER_SETTINGS_HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-section underline underline-offset-2 hover:no-underline"
            >
              {BROWSER_SETTINGS_HELP_LABEL} <span className="sr-only">(opens in a new tab)</span>
            </a>
          </>
        )}
      </span>
    </p>
  );
}

/** iOS before the app is on the home screen: the install sequence, in place of toggles. */
export function IosInstallLine(): ReactElement {
  return (
    <p className="flex items-start gap-2 text-body text-secondary">
      <Icon name="share" size={20} className="mt-0.5 shrink-0 text-section" />
      <span className="max-w-[70ch]">{IOS_INSTALL_MESSAGE}</span>
    </p>
  );
}

export function UnsupportedLine(): ReactElement {
  return <p className="max-w-[70ch] text-body text-secondary">{UNSUPPORTED_MESSAGE}</p>;
}
