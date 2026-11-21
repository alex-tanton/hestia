import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALEX_ID, JORDAN_ID, SAM_ID, oakStreetMembers } from '../../test/fixtures.ts';
import { getMdAccessibleName, getMdButton } from '../../test/md-queries.ts';
import { RotationEditor } from './RotationEditor.tsx';

/*
 * Full operation without a pointer is required. Every case in the first describe drives the
 * editor with userEvent's keyboard only, with no clicks; the pointer path (drag) has its own
 * case at the end.
 */

function Harness({
  initial = [ALEX_ID, SAM_ID, JORDAN_ID],
  disabledReason,
  onOrder,
}: {
  initial?: string[];
  disabledReason?: string;
  onOrder?: (order: string[]) => void;
}): ReactElement {
  const [order, setOrder] = useState(initial);
  return (
    <RotationEditor
      members={oakStreetMembers}
      order={order}
      disabledReason={disabledReason}
      onChange={(next) => {
        setOrder(next);
        onOrder?.(next);
      }}
    />
  );
}

function names(): string[] {
  return within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((item) => item.textContent.replace(/^\d+\.\s*/, ''));
}

function focusedName(): string {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return '';
  return getMdAccessibleName(active);
}

async function focusInnerButton(host: HTMLElement): Promise<HTMLElement> {
  return waitFor(() => {
    const btn = host.shadowRoot?.querySelector<HTMLElement>('button');
    if (!btn) throw new Error(`Expected shadow button inside <${host.localName}>`);
    btn.focus();
    return btn;
  });
}

describe('the rotation editor, keyboard only', () => {
  beforeEach(() => {
    interface PatchedElement extends HTMLElement {
      disabled?: boolean;
      __tabPatched?: boolean;
    }
    const proto = customElements.get('md-icon-button')?.prototype as
      | (PatchedElement & {
          connectedCallback?: () => void;
          updated?: (changed: Map<string, unknown>) => void;
        })
      | undefined;
    if (proto && !proto.__tabPatched) {
      const origConnected = proto.connectedCallback;
      proto.connectedCallback = function (this: PatchedElement) {
        origConnected?.call(this);
        if (!this.hasAttribute('tabindex')) {
          this.tabIndex = this.disabled ? -1 : 0;
        }
      };
      const origUpdated = proto.updated;
      proto.updated = function (this: PatchedElement, changed: Map<string, unknown>) {
        origUpdated?.call(this, changed);
        if (changed.has('disabled')) {
          this.tabIndex = this.disabled ? -1 : 0;
        }
      };
      proto.__tabPatched = true;
    }
  });

  it('reaches every enabled control in order, and skips the edge buttons that are disabled', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const visited: string[] = [];
    for (let step = 0; step < 7; step += 1) {
      await user.tab();
      visited.push(focusedName());
    }
    expect(visited).toEqual([
      'Move Alex Rivera down',
      'Remove Alex Rivera from rotation',
      'Move Sam Chen up',
      'Move Sam Chen down',
      'Remove Sam Chen from rotation',
      'Move Jordan Blake up',
      'Remove Jordan Blake from rotation',
    ]);
    // Past the last control, focus leaves the editor.
    await user.tab();
    expect(document.body).toHaveFocus();

    expect(getMdButton('Move Alex Rivera up')).toHaveProperty('disabled', true);
    expect(getMdButton('Move Jordan Blake down')).toHaveProperty('disabled', true);
  });

  it('moves a member with Enter, and focus follows the member', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await focusInnerButton(getMdButton('Move Sam Chen down'));
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(names()).toEqual(['Alex Rivera', 'Jordan Blake', 'Sam Chen']);
      // Sam is last now, so "down" is disabled and focus lands on the row's other move button.
      expect(focusedName()).toBe('Move Sam Chen up');
    });
  });

  it('moves a member with Space', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await focusInnerButton(getMdButton('Move Jordan Blake up'));
    await user.keyboard(' ');

    await waitFor(() => {
      expect(names()).toEqual(['Alex Rivera', 'Jordan Blake', 'Sam Chen']);
      expect(focusedName()).toBe('Move Jordan Blake up');
    });
  });

  it('removes a member with Enter, and focus lands on the member who took the place', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await focusInnerButton(getMdButton('Remove Sam Chen from rotation'));
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(names()).toEqual(['Alex Rivera', 'Jordan Blake']);
      expect(focusedName()).toBe('Remove Jordan Blake from rotation');
    });
  });

  it('puts focus on the heading when the last member is removed', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[ALEX_ID]} />);

    await focusInnerButton(getMdButton('Remove Alex Rivera from rotation'));
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Rotation order' })).toHaveFocus();
    });
  });

  it('is operable by no one while it is unavailable', async () => {
    const user = userEvent.setup();
    const onOrder = vi.fn();
    render(<Harness disabledReason="Needs a connection." onOrder={onOrder} />);

    const buttons = document.querySelectorAll<HTMLElement>('md-icon-button[data-member]');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toHaveProperty('disabled', true);
    }
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onOrder).not.toHaveBeenCalled();
    expect(screen.getByText('Needs a connection.')).toBeInTheDocument();
  });
});

describe('the rotation editor, pointer', () => {
  it('reorders by dragging a member’s handle onto another row', () => {
    const onOrder = vi.fn();
    render(<Harness onOrder={onOrder} />);

    const handle = screen.getByRole('button', { name: 'Drag Alex Rivera to reorder' });
    expect(handle).toHaveAttribute('draggable', 'true');
    // The list item keeps plain list semantics: it is not the drag source or a drop target.
    expect(screen.getAllByRole('listitem')[0]).not.toHaveAttribute('draggable');
    const target = screen.getByText('3. Jordan Blake').closest('[role="presentation"]');
    expect(target).not.toBeNull();

    fireEvent.dragStart(handle);
    fireEvent.dragOver(target!);
    fireEvent.drop(target!);

    expect(onOrder).toHaveBeenCalledWith([SAM_ID, JORDAN_ID, ALEX_ID]);
  });
});
