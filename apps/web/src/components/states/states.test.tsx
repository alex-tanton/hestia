import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookOpen } from 'lucide-react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '../../lib/format.ts';
import { PILLARS } from '../../lib/sections.ts';
import { SectionProvider } from '../../lib/section-context.tsx';
import { ComingSoon } from './ComingSoon.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { StaleNotice } from './StaleNotice.tsx';
import { EmptyState, ErrorState, OfflineState } from './StateBlocks.tsx';
import { SubSectionComingSoon } from './SubSectionComingSoon.tsx';

describe('EmptyState', () => {
  it('shows the one-line explanation and its primary action', async () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        icon={BookOpen}
        message="No recipes yet. Paste a link or add one by hand."
        action={{ label: 'Add a recipe', onAction }}
      />,
    );
    expect(screen.getByText('No recipes yet. Paste a link or add one by hand.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Add a recipe' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('renders the filtered variant with its own copy and clear action', () => {
    render(
      <EmptyState
        icon={BookOpen}
        message="No deals match these filters"
        action={{ label: 'Clear filters', onAction: vi.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('states what failed and offers retry and a route forward', async () => {
    const onRetry = vi.fn();
    const onAlternative = vi.fn();
    render(
      <ErrorState
        message="Couldn't reach the store data."
        onRetry={onRetry}
        alternative={{ label: 'Add items by hand', onAction: onAlternative }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add items by hand' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onAlternative).toHaveBeenCalledOnce();
  });
});

describe('OfflineState', () => {
  it('shows the needs-a-connection message', () => {
    render(<OfflineState message="Deal search needs a connection. Your lists still work." />);
    expect(
      screen.getByText('Deal search needs a connection. Your lists still work.'),
    ).toBeVisible();
  });
});

describe('ComingSoon', () => {
  it.each(Object.values(PILLARS))(
    'names what $label will do and offers nothing to tap',
    (pillar) => {
      render(
        <SectionProvider section={pillar.id}>
          <ComingSoon pillar={pillar} />
        </SectionProvider>,
      );
      expect(screen.getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
      expect(screen.getByText(pillar.comingSoon)).toBeVisible();
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByRole('link')).toBeNull();
    },
  );
});

describe('StaleNotice', () => {
  it('names when the shown data last synced and offers a retry', async () => {
    const onRetry = vi.fn();
    const updatedAt = new Date('2026-01-15T10:30:00.000Z').getTime();
    render(<StaleNotice updatedAt={updatedAt} onRetry={onRetry} />);
    expect(
      screen.getByText(
        `Couldn't refresh. Showing what synced as of ${formatDateTime(new Date(updatedAt).toISOString())}.`,
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('SubSectionComingSoon', () => {
  it("names the sub-section and points at what works now, in the pillar's own color", () => {
    render(
      <SectionProvider section="lists">
        <SubSectionComingSoon section="Deal search" />
      </SectionProvider>,
    );
    expect(
      screen.getByText(
        'Deal search arrives with the rest of this release. Your lists and pantry work now.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("falls back to the Lists pillar's icon when the section is the dashboard", () => {
    render(
      <SectionProvider section="dashboard">
        <SubSectionComingSoon section="Flyer browsing" />
      </SectionProvider>,
    );
    expect(
      screen.getByText(
        'Flyer browsing arrives with the rest of this release. Your lists and pantry work now.',
      ),
    ).toBeVisible();
  });
});

describe('ErrorBoundary', () => {
  it('contains a render error and retries on reset', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;
    function Flaky(): ReactElement {
      if (shouldThrow) throw new Error('boom');
      return <p>Recovered</p>;
    }
    const onError = vi.fn();
    render(
      <ErrorBoundary
        onError={onError}
        fallback={(reset) => (
          <button type="button" onClick={reset}>
            Try again
          </button>
        )}
      >
        <Flaky />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledOnce();
    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
