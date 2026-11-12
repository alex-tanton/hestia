import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionProvider } from '../../lib/section-context.tsx';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import {
  getMdAccessibleName,
  getMdButton,
  getMdCheckbox,
  getMdDialog,
  getMdField,
  getMdMenuItem,
  getMdSelect,
  getMdSwitch,
  getMdTab,
  queryMdDialog,
} from '../../test/md-queries.ts';
import { MdFilledButton, MdIconButton, MdOutlinedButton, MdTextButton } from '../md/MdButton.tsx';
import { MdCheckbox } from '../md/MdCheckbox.tsx';
import { MdDialog } from '../md/MdDialog.tsx';
import { MdMenu, MdMenuItem } from '../md/MdMenu.tsx';
import { MdCircularProgress } from '../md/MdProgress.tsx';
import { MdRadio } from '../md/MdRadio.tsx';
import { MdOutlinedSelect, MdSelectOption } from '../md/MdSelect.tsx';
import { MdSwitch } from '../md/MdSwitch.tsx';
import { MdPrimaryTab, MdTabs } from '../md/MdTabs.tsx';
import { MdOutlinedTextField } from '../md/MdTextField.tsx';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { Card } from './Card.tsx';
import { Checkbox } from './Checkbox.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { DateField } from './DateField.tsx';
import { TextAreaField, TextField } from './Field.tsx';
import { ListRow } from './ListRow.tsx';
import { OverflowMenu } from './OverflowMenu.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import { Select } from './Select.tsx';
import { Sheet } from './Sheet.tsx';
import { SkeletonRows } from './Skeleton.tsx';
import { Tabs } from './Tabs.tsx';
import { TimeField } from './TimeField.tsx';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Button', () => {
  it.each([
    ['primary', 'MD-FILLED-BUTTON'],
    ['secondary', 'MD-OUTLINED-BUTTON'],
    ['ghost', 'MD-TEXT-BUTTON'],
    ['destructive', 'MD-FILLED-BUTTON'],
  ] as const)('renders the %s variant as an enabled %s', async (variant, tagName) => {
    render(<Button variant={variant}>Save</Button>);
    const button = getMdButton('Save');
    expect(button.tagName).toBe(tagName);
    expect(button).toHaveProperty('type', 'button');
    expect(button).toHaveProperty('disabled', false);
    expect(button).toHaveProperty('softDisabled', false);
    await waitFor(() => {
      const inner = button.shadowRoot?.querySelector('button');
      expect(inner).not.toBeNull();
      expect(inner).toBeEnabled();
    });
  });

  it('renders icon-only buttons on md-icon-button', () => {
    render(
      <Button variant="ghost" isIconOnly aria-label="Remove row">
        <span aria-hidden="true">×</span>
      </Button>,
    );
    const button = getMdButton('Remove row');
    expect(button.tagName).toBe('MD-ICON-BUTTON');
    expect(getMdAccessibleName(button)).toBe('Remove row');
  });

  it('delegates focus from a host ref and activates on click and keyboard', async () => {
    const onClick = vi.fn();
    function FocusHarness(): ReactElement {
      const ref = useRef<HTMLElement>(null);
      return (
        <div>
          <Button ref={ref} onClick={onClick}>
            Save
          </Button>
          <button type="button" onClick={() => ref.current?.focus()}>
            Focus save
          </button>
        </div>
      );
    }

    render(<FocusHarness />);
    const button = getMdButton('Save');
    await userEvent.click(screen.getByRole('button', { name: 'Focus save' }));
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('is busy via softDisabled and ignores presses while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Save
      </Button>,
    );
    const button = getMdButton('Save');
    expect(button.querySelector('md-circular-progress')).not.toBeNull();
    expect(button).toHaveProperty('disabled', false);
    expect(button).toHaveProperty('softDisabled', true);
    expect(
      button.getAttribute('aria-busy') ?? button.getAttribute('data-aria-busy'),
    ).not.toBeNull();
    await waitFor(() => {
      const inner = button.shadowRoot?.querySelector('button');
      expect(inner).toHaveAttribute('aria-disabled', 'true');
    });
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses hard disabled separately from softDisabled when disabled', async () => {
    render(<Button disabled>Save</Button>);
    const button = getMdButton('Save');
    expect(button).toHaveProperty('disabled', true);
    expect(button).toHaveProperty('softDisabled', false);
    await waitFor(() => {
      const inner = button.shadowRoot?.querySelector('button');
      expect(inner).toBeDisabled();
    });
  });

  it('stays focusable with softDisabled and explains itself when unavailable offline', async () => {
    const onClick = vi.fn();
    render(
      <Button disabledReason="Needs a connection." onClick={onClick}>
        Invite
      </Button>,
    );
    const button = getMdButton('Invite');
    expect(button).toHaveProperty('disabled', false);
    expect(button).toHaveProperty('softDisabled', true);
    expect(button).toHaveAccessibleDescription('Needs a connection.');
    expect(screen.getByText('Needs a connection.')).toBeVisible();
    await waitFor(() => {
      const inner = button.shadowRoot?.querySelector('button');
      expect(inner).toHaveAttribute('aria-disabled', 'true');
    });
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField and TextAreaField', () => {
  it('labels the host and forwards placeholder, type, autoComplete, and className', async () => {
    render(
      <TextField
        label="Password"
        type="password"
        placeholder="Enter password"
        autoComplete="current-password"
        hint="At least 8 characters"
        className="max-w-sm"
      />,
    );
    const field = getMdField('Password');
    expect(field.tagName).toBe('MD-OUTLINED-TEXT-FIELD');
    expect(field).toHaveProperty('type', 'password');
    expect(field).toHaveProperty('placeholder', 'Enter password');
    expect(field).toHaveProperty('autocomplete', 'current-password');
    expect(field).toHaveProperty('supportingText', 'At least 8 characters');
    expect(field).toHaveClass('max-w-sm');
    await waitFor(() => {
      expect(field.shadowRoot?.querySelector('input')).toHaveAttribute('type', 'password');
    });
  });

  it('delegates focus from a ref and works with useFieldErrors', async () => {
    function Harness(): ReactElement {
      const fieldRef = useRef<HTMLElement>(null);
      const { errors, setErrors, formRef } = useFieldErrors<'password'>();
      return (
        <form
          ref={formRef}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setErrors({ password: 'That password is too common. Choose another.' });
          }}
        >
          <TextField ref={fieldRef} label="Password" error={errors.password} />
          <button type="submit">Submit</button>
          <button type="button" onClick={() => fieldRef.current?.focus()}>
            Focus password
          </button>
        </form>
      );
    }

    render(<Harness />);
    const field = getMdField('Password');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(field).toHaveProperty('error', true);
    expect(field).toHaveProperty('errorText', 'That password is too common. Choose another.');
    await waitFor(() => {
      const alert = field.shadowRoot
        ?.querySelector('md-outlined-field')
        ?.shadowRoot?.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert).toHaveTextContent('That password is too common. Choose another.');
      expect(field.shadowRoot?.querySelector('input')).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveFocus();
    });
    expect(field.shadowRoot?.activeElement?.tagName).toBe('INPUT');

    screen.getByRole('button', { name: 'Submit' }).focus();
    await userEvent.click(screen.getByRole('button', { name: 'Focus password' }));
    expect(field).toHaveFocus();
  });

  it('disables TextAreaField with an inline reason and default rows', async () => {
    render(<TextAreaField label="Instructions" disabledReason="Needs a connection." />);
    const textarea = getMdField('Instructions');
    expect(textarea.tagName).toBe('MD-OUTLINED-TEXT-FIELD');
    expect(textarea).toHaveProperty('type', 'textarea');
    expect(textarea).toHaveProperty('rows', 4);
    expect(textarea).toHaveProperty('disabled', true);
    expect(textarea).toHaveProperty('supportingText', 'Needs a connection.');
    await waitFor(() => {
      expect(textarea.shadowRoot?.querySelector('textarea')).toBeDisabled();
    });
  });

  it('accepts typing, empty values, maxLength, and onKeyDown', async () => {
    const onKeyDown = vi.fn();
    function TypingHarness(): ReactElement {
      const [value, setValue] = useState('');
      return (
        <TextField
          label="Household name"
          type="email"
          maxLength={20}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
      );
    }

    render(<TypingHarness />);
    const field = getMdField('Household name');
    expect(field).toHaveProperty('type', 'email');
    expect(field).toHaveProperty('maxLength', 20);
    await waitFor(() => {
      expect(field.shadowRoot?.querySelector('input')).not.toBeNull();
    });
    const innerInput = field.shadowRoot?.querySelector('input');
    if (innerInput === null || innerInput === undefined) {
      throw new Error('Expected shadow input inside md-outlined-text-field');
    }
    await userEvent.type(innerInput, 'Oak Street');
    expect(field).toHaveProperty('value', 'Oak Street');
    await userEvent.keyboard('{Enter}');
    expect(onKeyDown).toHaveBeenCalled();
    fireEvent.input(innerInput, { target: { value: '' } });
    expect(field).toHaveProperty('value', '');
  });
});

describe('DateField and TimeField', () => {
  it('renders native date and time pickers at 56px height and forwards className', () => {
    const onDateChange = vi.fn();
    const onTimeChange = vi.fn();
    render(
      <div>
        <DateField
          label="Due date"
          value="2026-10-14"
          className="w-40"
          onChange={(e) => {
            onDateChange(e.target.value);
          }}
        />
        <TimeField
          label="Reminder time"
          value="09:30"
          className="w-40"
          error="Pick a future time"
          onChange={(e) => {
            onTimeChange(e.target.value);
          }}
        />
        <TextField label="Delegated date" type="date" className="w-44" />
        <TextField label="Delegated time" type="time" className="w-44" />
      </div>,
    );

    const dateInput = screen.getByLabelText('Due date');
    expect(dateInput.tagName).toBe('INPUT');
    expect(dateInput).toHaveAttribute('type', 'date');
    expect(dateInput).toHaveClass('min-h-14');
    expect(dateInput.closest('.w-40')).not.toBeNull();
    fireEvent.change(dateInput, { target: { value: '2026-10-15' } });
    expect(onDateChange).toHaveBeenCalledWith('2026-10-15');

    const timeInput = screen.getByLabelText('Reminder time');
    expect(timeInput.tagName).toBe('INPUT');
    expect(timeInput).toHaveAttribute('type', 'time');
    expect(timeInput).toBeInvalid();
    expect(timeInput).toHaveAccessibleDescription('Pick a future time');
    expect(timeInput).toHaveClass('min-h-14');
    expect(timeInput.closest('.w-40')).not.toBeNull();
    fireEvent.change(timeInput, { target: { value: '10:00' } });
    expect(onTimeChange).toHaveBeenCalledWith('10:00');

    expect(screen.getByLabelText('Delegated date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Delegated date').closest('.w-44')).not.toBeNull();
    expect(screen.getByLabelText('Delegated time')).toHaveAttribute('type', 'time');
    expect(screen.getByLabelText('Delegated time').closest('.w-44')).not.toBeNull();
  });
});

describe('Select', () => {
  const options = [
    { value: 'America/New_York', label: 'America/New_York' },
    { value: 'America/Chicago', label: 'America/Chicago' },
  ];

  function Harness({
    selectOptions = options,
    initialValue = 'America/New_York',
  }: {
    selectOptions?: readonly { value: string; label: string }[];
    initialValue?: string;
  }): ReactElement {
    const [value, setValue] = useState(initialValue);
    return (
      <Select label="Timezone" options={selectOptions} value={value} onValueChange={setValue} />
    );
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
    expect(select).toHaveClass('min-h-14');
    await userEvent.selectOptions(select, 'America/Chicago');
    expect(select).toHaveValue('America/Chicago');
  });

  it('uses md-outlined-select with menuPositioning="fixed" on fine pointer and updates on change', async () => {
    render(<Harness />);
    const select = getMdSelect('Timezone');
    expect(select.tagName).toBe('MD-OUTLINED-SELECT');
    expect(select).toHaveProperty('menuPositioning', 'fixed');

    await waitFor(() => {
      expect(select).toHaveProperty('value', 'America/New_York');
    });

    const optionTexts = Array.from(select.querySelectorAll('md-select-option')).map((option) =>
      option.textContent.trim(),
    );
    expect(optionTexts).toEqual(['America/New_York', 'America/Chicago']);

    act(() => {
      Reflect.set(select, 'value', 'America/Chicago');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(select).toHaveProperty('value', 'America/Chicago');
  });

  it('renders cleanly with empty options or an unmatched value', () => {
    const { rerender } = render(<Harness selectOptions={[]} initialValue="" />);
    const emptySelect = getMdSelect('Timezone');
    expect(emptySelect.querySelectorAll('md-select-option')).toHaveLength(0);
    expect(emptySelect).toHaveProperty('value', '');

    rerender(<Harness selectOptions={options} initialValue="Pacific/Auckland" />);
    expect(getMdSelect('Timezone').querySelectorAll('md-select-option')).toHaveLength(2);
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
    const trigger = getMdButton('More actions for This Week');
    await waitFor(() => {
      expect(trigger.shadowRoot?.querySelector('button')).not.toBeNull();
    });
    trigger.shadowRoot?.querySelector('button')?.focus();
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
    await userEvent.click(getMdButton('Delete'));
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
    expect(getMdButton('Delete household')).toHaveProperty('disabled', true);
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
    const confirmButton = getMdButton('Delete household');
    expect(
      confirmButton.getAttribute('aria-busy') ?? confirmButton.getAttribute('data-aria-busy'),
    ).not.toBeNull();
  });
});

describe('D-13 Material Web jsdom smoke gate', () => {
  it('1. useFieldErrors focuses the invalid md-outlined-text-field host and delegated shadow input', async () => {
    function ErrorFormHarness(): ReactElement {
      const { errors, setErrors, formRef } = useFieldErrors<'email'>();
      const [email, setEmail] = useState('');

      return (
        <form
          ref={formRef}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (email.trim() === '') {
              setErrors({ email: 'Enter an email address.' });
            }
          }}
        >
          <MdOutlinedTextField
            label="Email"
            value={email}
            aria-invalid={errors.email ? 'true' : undefined}
            error={Boolean(errors.email)}
            errorText={errors.email ?? ''}
            onInput={(event) => {
              const value: unknown = event.currentTarget
                ? Reflect.get(event.currentTarget, 'value')
                : undefined;
              if (typeof value === 'string') {
                setEmail(value);
              }
            }}
          />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<ErrorFormHarness />);
    const host = getMdField('Email');
    if ('updateComplete' in host && host.updateComplete instanceof Promise) {
      await host.updateComplete;
    }

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(host).toHaveAttribute('error');
      expect(host.shadowRoot?.querySelector('input')).toHaveAttribute('aria-invalid', 'true');
      expect(document.activeElement).toBe(host);
    });
    expect(host.shadowRoot?.activeElement?.tagName).toBe('INPUT');
  });

  it('2. toggles md-checkbox (.checked) and md-switch (.selected) cleanly', async () => {
    const onCheckboxChange = vi.fn();
    const onSwitchChange = vi.fn();

    function ToggleHarness(): ReactElement {
      const [checked, setChecked] = useState(false);
      const [selected, setSelected] = useState(false);

      return (
        <div>
          <MdCheckbox
            aria-label="Agree to terms"
            checked={checked}
            onChange={(event) => {
              const next: unknown = event.currentTarget
                ? Reflect.get(event.currentTarget, 'checked')
                : undefined;
              if (typeof next === 'boolean') {
                setChecked(next);
                onCheckboxChange(next);
              }
            }}
          />
          <MdSwitch
            aria-label="Enable reminders"
            selected={selected}
            onChange={(event) => {
              const next: unknown = event.currentTarget
                ? Reflect.get(event.currentTarget, 'selected')
                : undefined;
              if (typeof next === 'boolean') {
                setSelected(next);
                onSwitchChange(next);
              }
            }}
          />
        </div>
      );
    }

    render(<ToggleHarness />);
    const checkbox = getMdCheckbox('Agree to terms');
    const switchEl = getMdSwitch('Enable reminders');

    await waitFor(() => {
      expect(checkbox.shadowRoot?.querySelector('input')).not.toBeNull();
      expect(switchEl.shadowRoot?.querySelector('input')).not.toBeNull();
    });

    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(onCheckboxChange).toHaveBeenCalledWith(true);
      expect(Reflect.get(checkbox, 'checked')).toBe(true);
    });

    await userEvent.click(switchEl);
    await waitFor(() => {
      expect(onSwitchChange).toHaveBeenCalledWith(true);
      expect(Reflect.get(switchEl, 'selected')).toBe(true);
    });
  });

  it('3. coerces md-radio validity with setValidity and zero ElementInternals exceptions', async () => {
    const onRadioChange = vi.fn();

    function RadioHarness(): ReactElement {
      const [choice, setChoice] = useState('');
      return (
        <form>
          <MdRadio
            name="choice"
            value="a"
            required
            aria-label="Option A"
            checked={choice === 'a'}
            onChange={() => {
              setChoice('a');
              onRadioChange('a');
            }}
          />
          <MdRadio
            name="choice"
            value="b"
            aria-label="Option B"
            checked={choice === 'b'}
            onChange={() => {
              setChoice('b');
              onRadioChange('b');
            }}
          />
        </form>
      );
    }

    const { container } = render(<RadioHarness />);
    const radios = container.querySelectorAll('md-radio');
    const radioA = radios[0]!;
    const form = container.querySelector('form')!;

    await waitFor(() => {
      expect(radioA.shadowRoot?.querySelector('.container')).not.toBeNull();
    });

    expect(() => radioA.checkValidity()).not.toThrow();
    expect(() => radioA.reportValidity()).not.toThrow();
    expect(radioA.checkValidity()).toBe(false);
    expect(form.checkValidity()).toBe(false);

    await userEvent.click(radioA);
    await waitFor(() => {
      expect(onRadioChange).toHaveBeenCalledWith('a');
      expect(Reflect.get(radioA, 'checked')).toBe(true);
    });
    expect(radioA.checkValidity()).toBe(true);
    expect(radioA.reportValidity()).toBe(true);
    expect(form.checkValidity()).toBe(true);
  });

  it('4. syncs md-dialog cancel/closed state and restores focus on native dialog.showModal()/close()', async () => {
    const onCancel = vi.fn();

    function DialogHarness(): ReactElement {
      const [mdOpen, setMdOpen] = useState(false);
      const nativeDialogRef = useRef<HTMLDialogElement>(null);
      const triggerRef = useRef<HTMLButtonElement>(null);

      return (
        <div>
          <button
            type="button"
            onClick={() => {
              setMdOpen(true);
            }}
          >
            Open MD dialog
          </button>
          <MdDialog
            open={mdOpen}
            onCancel={() => {
              onCancel();
            }}
            onClosed={() => {
              setMdOpen(false);
            }}
          >
            <div slot="headline">Confirm action</div>
            <div slot="content">Proceed with update?</div>
            <div slot="actions">
              <MdTextButton
                type="button"
                onClick={() => {
                  setMdOpen(false);
                }}
              >
                Close
              </MdTextButton>
            </div>
          </MdDialog>

          <button
            ref={triggerRef}
            type="button"
            onClick={() => {
              nativeDialogRef.current?.showModal();
            }}
          >
            Open native sheet
          </button>
          <dialog
            ref={nativeDialogRef}
            aria-label="Native sheet"
            onClose={() => {
              triggerRef.current?.focus();
            }}
          >
            <p>Sheet content</p>
            <button
              type="button"
              onClick={() => {
                nativeDialogRef.current?.close();
              }}
            >
              Done
            </button>
          </dialog>
        </div>
      );
    }

    render(<DialogHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'Open MD dialog' }));
    const mdDialog = await waitFor(() => getMdDialog('Confirm action'));
    expect(mdDialog).toHaveAttribute('open');

    const innerDialog = mdDialog.shadowRoot?.querySelector('dialog');
    expect(innerDialog).not.toBeNull();
    act(() => {
      innerDialog?.dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    expect(onCancel).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(queryMdDialog('Confirm action')).toBeNull();
    });

    const nativeTrigger = screen.getByRole('button', { name: 'Open native sheet' });
    nativeTrigger.focus();
    expect(nativeTrigger).toHaveFocus();
    await userEvent.click(nativeTrigger);

    const nativeDialog = getMdDialog('Native sheet');
    expect(nativeDialog).toHaveAttribute('open');
    const doneBtn = screen.getByRole('button', { name: 'Done' });
    doneBtn.focus();
    await userEvent.click(doneBtn);

    expect(queryMdDialog('Native sheet')).toBeNull();
    expect(nativeTrigger).toHaveFocus();
  });

  it('5. selects an option cleanly in md-outlined-select with menuPositioning="fixed"', async () => {
    const onSelectChange = vi.fn();

    function SelectHarness(): ReactElement {
      const [category, setCategory] = useState('produce');
      return (
        <MdOutlinedSelect
          menuPositioning="fixed"
          label="Category"
          value={category}
          onChange={(event) => {
            const next: unknown = event.currentTarget
              ? Reflect.get(event.currentTarget, 'value')
              : undefined;
            if (typeof next === 'string') {
              setCategory(next);
              onSelectChange(next);
            }
          }}
        >
          <MdSelectOption value="produce">
            <div slot="headline">Produce</div>
          </MdSelectOption>
          <MdSelectOption value="dairy">
            <div slot="headline">Dairy</div>
          </MdSelectOption>
        </MdOutlinedSelect>
      );
    }

    render(<SelectHarness />);
    const select = getMdSelect('Category');
    expect(Reflect.get(select, 'menuPositioning')).toBe('fixed');

    await waitFor(() => {
      expect(select.shadowRoot?.querySelector('md-menu')).not.toBeNull();
    });

    const field = select.shadowRoot?.querySelector<HTMLElement>('.field');
    expect(field).not.toBeNull();
    await userEvent.click(field!);
    await waitFor(() => {
      expect(Reflect.get(select, 'open')).toBe(true);
    });

    const dairyOption = screen.getByText('Dairy').closest('md-select-option');
    expect(dairyOption).not.toBeNull();
    const dairyOptionButton =
      dairyOption?.shadowRoot?.querySelector<HTMLElement>('[role="option"]');
    expect(dairyOptionButton).not.toBeNull();
    await userEvent.click(dairyOptionButton!);

    await waitFor(() => {
      expect(onSelectChange).toHaveBeenCalledWith('dairy');
      expect(Reflect.get(select, 'value')).toBe('dairy');
    });
  });

  it('renders baseline MdButton variants, MdMenu, MdTabs, and MdCircularProgress adapters', async () => {
    const onTabChange = vi.fn();
    const onMenuAction = vi.fn();

    function BaselineHarness(): ReactElement {
      const [menuOpen, setMenuOpen] = useState(false);

      return (
        <div>
          <MdFilledButton type="button">Filled</MdFilledButton>
          <MdOutlinedButton type="button">Outlined</MdOutlinedButton>
          <MdTextButton type="button">Text</MdTextButton>
          <MdIconButton
            id="smoke-menu-anchor"
            type="button"
            aria-label="More options"
            onClick={() => {
              setMenuOpen(true);
            }}
          >
            <span>...</span>
          </MdIconButton>
          <MdMenu
            positioning="fixed"
            anchor="smoke-menu-anchor"
            open={menuOpen}
            onClosed={() => {
              setMenuOpen(false);
            }}
          >
            <MdMenuItem
              onClick={() => {
                onMenuAction();
              }}
            >
              <div slot="headline">Edit item</div>
            </MdMenuItem>
          </MdMenu>

          <MdTabs
            aria-label="Sections"
            activeTabIndex={0}
            onChange={(event) => {
              const next: unknown = event.currentTarget
                ? Reflect.get(event.currentTarget, 'activeTabIndex')
                : undefined;
              if (typeof next === 'number') {
                onTabChange(next);
              }
            }}
          >
            <MdPrimaryTab>First</MdPrimaryTab>
            <MdPrimaryTab>Second</MdPrimaryTab>
          </MdTabs>
          <MdCircularProgress indeterminate aria-label="Loading" />
        </div>
      );
    }

    const { container } = render(<BaselineHarness />);
    expect(getMdButton('Filled')).toBeInTheDocument();
    expect(getMdButton('Outlined')).toBeInTheDocument();
    expect(getMdButton('Text')).toBeInTheDocument();
    expect(getMdButton('More options')).toBeInTheDocument();
    expect(getMdTab('First')).toBeInTheDocument();
    expect(getMdTab('Second')).toBeInTheDocument();
    const progress = container.querySelector('md-circular-progress');
    expect(progress).not.toBeNull();
    expect(Reflect.get(progress!, 'indeterminate')).toBe(true);

    await userEvent.click(getMdButton('More options'));
    const editItem = await waitFor(() => getMdMenuItem('Edit item'));
    await userEvent.click(editItem);
    expect(onMenuAction).toHaveBeenCalledOnce();

    fireEvent.click(getMdTab('Second'));
    await waitFor(() => {
      expect(onTabChange).toHaveBeenCalledWith(1);
    });
  });
});
