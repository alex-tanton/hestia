import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, toastDuration, useToast, type ToastInput } from './Toast.tsx';

function Trigger({ toast }: { toast: ToastInput }): ReactElement {
  const show = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        show(toast);
      }}
    >
      Show
    </button>
  );
}

function renderWithToast(toast: ToastInput): void {
  render(
    <ToastProvider>
      <Trigger toast={toast} />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('toastDuration', () => {
  it('follows the Design timings', () => {
    expect(toastDuration({ variant: 'success', message: 'Added to Grocery List.' })).toBe(4000);
    expect(toastDuration({ variant: 'info', message: '3 changes synced.' })).toBe(4000);
    expect(
      toastDuration({
        variant: 'success',
        message: 'Take out trash done. Sam is next.',
        action: { label: 'Undo', onAction: vi.fn() },
      }),
    ).toBe(5000);
    expect(toastDuration({ variant: 'error', message: 'Could not save.' })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('ToastProvider', () => {
  it.each(['success', 'info'] as const)('shows a %s toast and dismisses it after 4s', (variant) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithToast({ variant, message: 'Added to Grocery List.' });
    act(() => {
      screen.getByRole('button', { name: 'Show' }).click();
    });
    expect(screen.getAllByText('Added to Grocery List.').length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(screen.queryByRole('status', { name: /Added to Grocery List/ })).toBeNull();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('keeps an error toast until it is dismissed', async () => {
    renderWithToast({ variant: 'error', message: "Couldn't save Milk." });
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getAllByText("Couldn't save Milk.").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('runs the action (Undo)', async () => {
    const onUndo = vi.fn();
    renderWithToast({
      variant: 'success',
      message: 'Take out trash done. Sam is next.',
      action: { label: 'Undo', onAction: onUndo },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
