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

function MultiTrigger({ toasts }: { toasts: ToastInput[] }): ReactElement {
  const show = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        for (const toast of toasts) {
          show(toast);
        }
      }}
    >
      Show all
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
  it('gives each variant its display duration (4s non-action, persistent error/action)', () => {
    expect(toastDuration({ variant: 'success', message: 'Added to Grocery List.' })).toBe(4000);
    expect(toastDuration({ variant: 'info', message: '3 changes synced.' })).toBe(4000);
    expect(
      toastDuration({
        variant: 'success',
        message: 'Take out trash done. Sam is next.',
        action: { label: 'Undo', onAction: vi.fn() },
      }),
    ).toBe(Number.POSITIVE_INFINITY);
    expect(toastDuration({ variant: 'error', message: 'Could not save.' })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('ToastProvider', () => {
  it.each(['success', 'info'] as const)(
    'shows a %s snackbar and dismisses it after 4s',
    (variant) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      renderWithToast({ variant, message: 'Added to Grocery List.' });
      act(() => {
        screen.getByRole('button', { name: 'Show' }).click();
      });
      expect(screen.getByRole('status')).toHaveTextContent('Added to Grocery List.');
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByRole('status')).toBeNull();
    },
  );

  it('keeps an error snackbar persistently as an alert until dismissed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithToast({ variant: 'error', message: "Couldn't save Milk." });
    act(() => {
      screen.getByRole('button', { name: 'Show' }).click();
    });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save Milk.");
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save Milk.");
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps action-bearing snackbars persistent until Undo or Dismiss is activated', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onUndo = vi.fn();
    renderWithToast({
      variant: 'success',
      message: 'Take out trash done. Sam is next.',
      action: { label: 'Undo', onAction: onUndo },
    });
    act(() => {
      screen.getByRole('button', { name: 'Show' }).click();
    });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Take out trash done. Sam is next.');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).toBeNull();

    const onIgnoredUndo = vi.fn();
    renderWithToast({
      variant: 'info',
      message: 'Water plants skipped.',
      action: { label: 'Undo', onAction: onIgnoredUndo },
    });
    const showButtons = screen.getAllByRole('button', { name: 'Show' });
    await userEvent.click(showButtons[1]!);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onIgnoredUndo).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders a single active snackbar at a time in FIFO queue order', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <MultiTrigger
          toasts={[
            { variant: 'success', message: 'First notice.' },
            { variant: 'info', message: 'Second notice.' },
            { variant: 'error', message: 'Third notice.' },
          ]}
        />
      </ToastProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'Show all' }).click();
    });

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('First notice.');
    expect(screen.queryByText('Second notice.')).toBeNull();
    expect(screen.queryByText('Third notice.')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByRole('status')).toHaveTextContent('Second notice.');
    expect(screen.queryByText('Third notice.')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Third notice.');
  });
});
