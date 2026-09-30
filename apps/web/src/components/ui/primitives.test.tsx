import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionProvider } from '../../lib/section-context.tsx';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { Card } from './Card.tsx';
import { Checkbox } from './Checkbox.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { TextAreaField, TextField } from './Field.tsx';
import { ListRow } from './ListRow.tsx';
import { OverflowMenu } from './OverflowMenu.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import { Select } from './Select.tsx';
import { Sheet } from './Sheet.tsx';
import { SkeletonRows } from './Skeleton.tsx';
import { Tabs } from './Tabs.tsx';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'destructive'] as const)(
    'renders the %s variant as an enabled button',
    (variant) => {
      render(<Button variant={variant}>Save</Button>);
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    },
  );

  it('fires onClick by keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is busy and ignores presses while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is disabled when disabled', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('stays focusable and explains itself when unavailable offline', async () => {
    const onClick = vi.fn();
    render(
      <Button disabledReason="Needs a connection." onClick={onClick}>
        Invite
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Invite' });
    expect(button).toHaveAccessibleDescription('Needs a connection.');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Needs a connection.')).toBeVisible();
    await userEvent.tab();
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField and TextAreaField', () => {
  it('labels the input and shows the hint as its description', () => {
    render(<TextField label="Password" hint="At least 8 characters" />);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('At least 8 characters');
  });

  it('links an error to its field, marks it invalid, and announces it', () => {
    render(<TextField label="Password" error="That password is too common. Choose another." />);
    const input = screen.getByLabelText('Password');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('That password is too common. Choose another.');
    expect(screen.getByRole('alert')).toHaveTextContent('That password is too common.');
  });

  it('disables the field with an inline reason', () => {
    render(<TextAreaField label="Instructions" disabledReason="Needs a connection." />);
    const textarea = screen.getByLabelText('Instructions');
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAccessibleDescription('Needs a connection.');
  });

  it('accepts typing', async () => {
    render(<TextField label="Household name" />);
    await userEvent.type(screen.getByLabelText('Household name'), 'Oak Street');
    expect(screen.getByLabelText('Household name')).toHaveValue('Oak Street');
  });
});

describe('Select', () => {
  const options = [
    { value: 'America/New_York', label: 'America/New_York' },
    { value: 'America/Chicago', label: 'America/Chicago' },
  ];

  function Harness(): ReactElement {
    const [value, setValue] = useState('America/New_York');
    return <Select label="Timezone" options={options} value={value} onValueChange={setValue} />;
  }

  it('uses the native picker on touch devices', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: coarse)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    render(<Harness />);
    const select = screen.getByRole('combobox', { name: 'Timezone' });
    expect(select.tagName).toBe('SELECT');
    await userEvent.selectOptions(select, 'America/Chicago');
    expect(select).toHaveValue('America/Chicago');
  });

  it('uses the Radix listbox with a fine pointer', () => {
    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: 'Timezone' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveTextContent('America/New_York');
  });
});

describe('Checkbox', () => {
  it('is a real checkbox whose whole in-list row toggles it', async () => {
    render(<Checkbox variant="in-list" label="Chicken thighs" detail={<span>$2.49/lb</span>} />);
    const checkbox = screen.getByRole('checkbox', { name: /Chicken thighs/ });
    await userEvent.click(screen.getByText('$2.49/lb'));
    expect(checkbox).toBeChecked();
  });

  it('toggles with Space and respects disabled', async () => {
    render(
      <>
        <Checkbox label="Milk" />
        <Checkbox label="Bread" disabled />
      </>,
    );
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(screen.getByRole('checkbox', { name: 'Milk' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Bread' })).toBeDisabled();
  });
});

describe('Badge and Card', () => {
  it('pairs the danger badge with an icon and its word', () => {
    const { container } = render(<Badge variant="danger">Overdue</Badge>);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('labels the personal badge "Personal" with the user icon', () => {
    const { container } = render(<Badge variant="personal" />);
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it.each(['neutral', 'section', 'warning'] as const)('renders the %s badge text', (variant) => {
    render(<Badge variant={variant}>Coupon</Badge>);
    expect(screen.getByText('Coupon')).toBeInTheDocument();
  });

  it('adds elevation only to raised cards', () => {
    render(
      <>
        <Card data-testid="flat">Flat</Card>
        <Card data-testid="raised" variant="raised">
          Raised
        </Card>
      </>,
    );
    expect(screen.getByTestId('flat')).not.toHaveClass('shadow-sm');
    expect(screen.getByTestId('raised')).toHaveClass('shadow-sm');
  });
});

describe('SkeletonRows', () => {
  it('announces loading at once but shows rows only after 200ms', () => {
    vi.useFakeTimers();
    render(<SkeletonRows label="Loading bills" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading bills');
    expect(screen.queryAllByTestId('skeleton-row')).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(3);
  });
});

describe('ListRow', () => {
  it('is a static row without onSelect and a button with it', async () => {
    const onSelect = vi.fn();
    render(
      <>
        <ListRow title="Static" />
        <ListRow title="Rivera Family" description="2 members" onSelect={onSelect} isCurrent />
      </>,
    );
    expect(screen.queryByRole('button', { name: /Static/ })).toBeNull();
    const row = screen.getByRole('button', { name: /Rivera Family/ });
    expect(row).toHaveAttribute('aria-current', 'true');
    await userEvent.click(row);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe('SegmentedControl', () => {
  function Harness(): ReactElement {
    const [value, setValue] = useState('a');
    return (
      <SegmentedControl
        label="Bills sections"
        segments={[
          { value: 'a', label: 'Bills' },
          { value: 'b', label: 'Subscriptions' },
        ]}
        value={value}
        onValueChange={setValue}
      />
    );
  }

  it('moves with arrow keys, selects with Enter, and never clears the selection', async () => {
    render(<Harness />);
    const bills = screen.getByRole('radio', { name: 'Bills' });
    const subscriptions = screen.getByRole('radio', { name: 'Subscriptions' });
    await userEvent.tab();
    expect(bills).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(subscriptions).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(subscriptions).toBeChecked();
    await userEvent.keyboard('{Enter}');
    expect(subscriptions).toBeChecked();
  });
});

describe('Tabs', () => {
  function Harness(): ReactElement {
    const [value, setValue] = useState('sun');
    return (
      <Tabs
        label="Day"
        value={value}
        onValueChange={setValue}
        items={[
          { value: 'sun', label: 'Sun', content: <p>Sunday meals</p> },
          { value: 'mon', label: 'Mon', content: <p>Monday meals</p> },
        ]}
      />
    );
  }

  it('switches panels from the keyboard', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Mon' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Monday meals')).toBeVisible();
  });

  it('scrolls the newly active tab into view, from the keyboard and not only a click', async () => {
    const scrollIntoView = vi.fn();
    const original: unknown = Reflect.get(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Harness />);

      await userEvent.tab();
      await userEvent.keyboard('{ArrowRight}');
      expect(scrollIntoView).toHaveBeenCalled();

      scrollIntoView.mockClear();
      await userEvent.click(screen.getByRole('tab', { name: 'Sun' }));
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      Reflect.set(Element.prototype, 'scrollIntoView', original);
    }
  });
});

describe('OverflowMenu', () => {
  it('opens from the keyboard and runs the chosen action', async () => {
    const onRename = vi.fn();
    render(
      <OverflowMenu
        label="More actions for This Week"
        items={[
          { label: 'Rename', onSelect: onRename },
          { label: 'Delete', onSelect: vi.fn(), isDestructive: true },
        ]}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    const rename = await screen.findByRole('menuitem', { name: 'Rename' });
    expect(rename).toBeInTheDocument();
    await userEvent.click(rename);
    expect(onRename).toHaveBeenCalledOnce();
  });
});

describe('Sheet', () => {
  function Harness(): ReactElement {
    const [open, setOpen] = useState(false);
    return (
      <SectionProvider section="chores">
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title="Add errand"
          trigger={<button type="button">Add errand</button>}
        >
          <button type="button">Save errand</button>
        </Sheet>
      </SectionProvider>
    );
  }

  it('opens as a dialog in the section color and returns focus to its trigger on close', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Add errand' });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Add errand' });
    expect(dialog).toHaveAttribute('data-section', 'chores');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('names the consequence, starts on Cancel, and confirms', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete This Week?"
        description="Its 15 items are removed permanently."
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Delete This Week?' });
    expect(dialog).toHaveAccessibleDescription('Its 15 items are removed permanently.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('holds the destructive action until allowed, and shows it busy while confirming', () => {
    const { rerender } = render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete Oak Street?"
        description="This deletes 4 lists, 23 recipes, and 6 chores permanently."
        confirmLabel="Delete household"
        onConfirm={vi.fn()}
        isConfirmDisabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete household' })).toBeDisabled();
    rerender(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete Oak Street?"
        description="This deletes 4 lists, 23 recipes, and 6 chores permanently."
        confirmLabel="Delete household"
        onConfirm={vi.fn()}
        isConfirming
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete household' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});
