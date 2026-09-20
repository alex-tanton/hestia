import { useId, type ReactElement, type ReactNode } from 'react';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** One of Settings' grouped sections (Design › Screens › 4). */
export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps): ReactElement {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-h2 text-primary">
        {title}
      </h2>
      {description !== undefined && (
        <p className="max-w-[70ch] text-body-sm text-secondary">{description}</p>
      )}
      {children}
    </section>
  );
}

/** A labelled read-only value, such as the detected timezone. */
export function ReadOnlyValue({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-body-sm font-semibold text-primary">{label}</span>
      <span className="text-body text-secondary">{value}</span>
    </div>
  );
}
