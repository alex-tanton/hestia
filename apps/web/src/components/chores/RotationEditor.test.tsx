import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ALEX_ID, JORDAN_ID, SAM_ID, oakStreetMembers } from '../../test/fixtures.ts';
import { RotationEditor } from './RotationEditor.tsx';

/*
 * Design › Accessibility › Keyboard: "Full operation without a pointer". Every case in the first
 * describe drives the editor with userEvent's keyboard only, with no clicks; the pointer path
 * (drag) has its own case at the end.
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
  return active.getAttribute('aria-label') ?? active.textContent;
}

describe('the rotation editor, keyboard only', () => {
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

    expect(screen.getByRole('button', { name: 'Move Alex Rivera up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Jordan Blake down' })).toBeDisabled();
  });

  it('moves a member with Enter, and focus follows the member', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole('button', { name: 'Move Sam Chen down' }).focus();
    await user.keyboard('{Enter}');

    expect(names()).toEqual(['Alex Rivera', 'Jordan Blake', 'Sam Chen']);
    // Sam is last now, so "down" is disabled and focus lands on the row's other move button.
    expect(focusedName()).toBe('Move Sam Chen up');
  });

  it('moves a member with Space', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole('button', { name: 'Move Jordan Blake up' }).focus();
    await user.keyboard(' ');

    expect(names()).toEqual(['Alex Rivera', 'Jordan Blake', 'Sam Chen']);
    expect(focusedName()).toBe('Move Jordan Blake up');
  });

  it('removes a member with Enter, and focus lands on the member who took the place', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole('button', { name: 'Remove Sam Chen from rotation' }).focus();
    await user.keyboard('{Enter}');

    expect(names()).toEqual(['Alex Rivera', 'Jordan Blake']);
    expect(focusedName()).toBe('Remove Jordan Blake from rotation');
  });

  it('puts focus on the heading when the last member is removed', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[ALEX_ID]} />);

    screen.getByRole('button', { name: 'Remove Alex Rivera from rotation' }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'Rotation order' })).toHaveFocus();
  });

  it('is operable by no one while it is unavailable', async () => {
    const user = userEvent.setup();
    const onOrder = vi.fn();
    render(<Harness disabledReason="Needs a connection." onOrder={onOrder} />);

    for (const button of screen.getAllByRole('button', { name: /^(Move|Remove) / })) {
      expect(button).toBeDisabled();
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
