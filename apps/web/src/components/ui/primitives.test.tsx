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
import { CopyButton } from './CopyButton.tsx';
import { DateField } from './DateField.tsx';
import { TextAreaField, TextField } from './Field.tsx';
import { FormMessage } from './FormMessage.tsx';
import { ListRow } from './ListRow.tsx';
import { ModalBottomSheet } from './ModalBottomSheet.tsx';
import { OverflowMenu } from './OverflowMenu.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import { Select } from './Select.tsx';
import { Sheet } from './Sheet.tsx';
import { Skeleton, SkeletonRows } from './Skeleton.tsx';
import { Switch } from './Switch.tsx';
import { Tabs } from './Tabs.tsx';
import { TimeField } from './TimeField.tsx';
import { ToastProvider } from './Toast.tsx';

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
  it('renders md-checkbox with a 44px row target and emits CheckboxChangeEvent + onCheckedChange', async () => {
    const handleChange = vi.fn();
    const handleCheckedChange = vi.fn();
    const { container } = render(
      <Checkbox
        variant="in-list"
        label="Chicken thighs"
        detail={<span>$2.49/lb</span>}
        onChange={handleChange}
        onCheckedChange={handleCheckedChange}
      />,
    );
    const checkbox = getMdCheckbox(/Chicken thighs/);
    const labelEl = container.querySelector('label');
    expect(labelEl?.className).toContain('min-h-11');
    expect(labelEl?.className).toContain('px-4');

    await waitFor(() => {
      expect(checkbox.shadowRoot?.querySelector('input')).not.toBeNull();
    });
    expect(labelEl?.control).toBe(checkbox);
    await userEvent.click(screen.getByText('$2.49/lb'));
    expect(checkbox).toHaveProperty('checked', true);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { checked: true },
        currentTarget: { checked: true },
      }),
    );
  });

  it('forwards indeterminate, respects disabled, and preserves min-h-11 for icon-only labels', async () => {
    const handleCheckedChange = vi.fn();
    const { container } = render(
      <>
        <Checkbox label="Select all" indeterminate />
        <Checkbox label="Bread" disabled onCheckedChange={handleCheckedChange} />
        <Checkbox label="" aria-label="Mark milk done" />
      </>,
    );
    expect(getMdCheckbox('Select all')).toHaveProperty('indeterminate', true);

    const disabledCheckbox = getMdCheckbox('Bread');
    expect(disabledCheckbox).toHaveProperty('disabled', true);
    await userEvent.click(disabledCheckbox);
    expect(handleCheckedChange).not.toHaveBeenCalled();

    const iconOnly = getMdCheckbox('Mark milk done');
    expect(iconOnly.closest('label')?.className).toContain('min-h-11');
    expect(container.querySelectorAll('md-checkbox')).toHaveLength(3);
  });
});

describe('Switch', () => {
  it('renders md-switch with selected state, 44px target, and normalized onCheckedChange', async () => {
    const handleCheckedChange = vi.fn();
    function Harness(): ReactElement {
      const [enabled, setEnabled] = useState(false);
      return (
        <Switch
          variant="in-list"
          label="New bills"
          detail={<span>Notify when a household bill is added</span>}
          checked={enabled}
          aria-describedby="bills-help"
          onCheckedChange={(next) => {
            setEnabled(next);
            handleCheckedChange(next);
          }}
        />
      );
    }

    const { container } = render(<Harness />);
    const toggle = getMdSwitch(/New bills/);
    const labelEl = container.querySelector('label');
    expect(labelEl?.className).toContain('min-h-11');
    expect(labelEl?.className).toContain('px-4');
    expect(toggle).toHaveProperty('selected', false);
    expect(toggle.getAttribute('aria-describedby')).toBe('bills-help');

    await userEvent.click(toggle);
    expect(toggle).toHaveProperty('selected', true);
    expect(handleCheckedChange).toHaveBeenCalledTimes(1);
    expect(handleCheckedChange).toHaveBeenLastCalledWith(true);

    // Verify input-only normalization also fires onCheckedChange.
    Object.defineProperty(toggle, 'selected', { value: false, configurable: true, writable: true });
    fireEvent.input(toggle);
    expect(handleCheckedChange).toHaveBeenCalledTimes(2);
    expect(handleCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it('respects disabled on Switch', async () => {
    const handleCheckedChange = vi.fn();
    render(
      <Switch label="Offline toggle" checked disabled onCheckedChange={handleCheckedChange} />,
    );
    const toggle = getMdSwitch('Offline toggle');
    expect(toggle).toHaveProperty('selected', true);
    expect(toggle).toHaveProperty('disabled', true);
    await userEvent.click(toggle);
    expect(handleCheckedChange).not.toHaveBeenCalled();
  });
});

describe('Badge and Card', () => {
  it('pairs the danger badge with an aria-hidden SVG icon, nowrap, and error container tokens', () => {
    const { container } = render(<Badge variant="danger">Overdue</Badge>);
    const badge = screen.getByText('Overdue');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('whitespace-nowrap');
    expect(badge).toHaveClass('bg-[var(--md-sys-color-error-container)]');
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('labels the personal badge "Personal" with the person SVG icon', () => {
    const { container } = render(<Badge variant="personal" />);
    const badge = screen.getByText('Personal');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('whitespace-nowrap');
    expect(badge).toHaveClass('bg-[var(--md-sys-color-surface-container-high)]');
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([
    ['neutral', 'bg-[var(--md-sys-color-surface-container-high)]'],
    ['section', 'bg-[var(--md-sys-color-secondary-container)]'],
    ['warning', 'bg-[var(--md-sys-color-warning-container)]'],
  ] as const)('renders the %s badge with tonal container styling', (variant, tokenClass) => {
    render(<Badge variant={variant}>Coupon</Badge>);
    const badge = screen.getByText('Coupon');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('whitespace-nowrap');
    expect(badge).toHaveClass(tokenClass);
  });

  it('renders borderless tonal Card surfaces without overflow clipping and adds elevation only to raised cards', () => {
    render(
      <>
        <Card data-testid="flat" as="section">
          Flat
        </Card>
        <Card data-testid="raised" variant="raised" as="article">
          Raised
        </Card>
      </>,
    );
    const flat = screen.getByTestId('flat');
    const raised = screen.getByTestId('raised');
    expect(flat.tagName).toBe('SECTION');
    expect(flat).toHaveClass('hestia-card', 'bg-[var(--md-sys-color-surface-container-low)]');
    expect(flat).not.toHaveClass('shadow-[var(--md-sys-elevation-1)]');
    expect(flat).not.toHaveClass('overflow-hidden');

    expect(raised.tagName).toBe('ARTICLE');
    expect(raised).toHaveClass(
      'hestia-card',
      'bg-[var(--md-sys-color-surface-container)]',
      'shadow-[var(--md-sys-elevation-1)]',
    );
    expect(raised).not.toHaveClass('overflow-hidden');
  });
});

describe('Skeleton and SkeletonRows', () => {
  it('announces loading at once with surface-container-highest blocks after 200ms', () => {
    vi.useFakeTimers();
    const { container } = render(
      <>
        <Skeleton className="h-4 w-24" />
        <SkeletonRows label="Loading bills" />
      </>,
    );
    expect(container.querySelector('.w-24')).toHaveClass(
      'bg-[var(--md-sys-color-surface-container-highest)]',
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading bills');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryAllByTestId('skeleton-row')).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const rows = screen.getAllByTestId('skeleton-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelector('span')).toHaveClass(
      'bg-[var(--md-sys-color-surface-container-highest)]',
    );
  });

  it('renders 0 skeleton rows when rows is 0', () => {
    vi.useFakeTimers();
    render(<SkeletonRows label="Loading empty list" rows={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading empty list');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryAllByTestId('skeleton-row')).toHaveLength(0);
  });
});

describe('ListRow', () => {
  it('is a static row without onSelect, a min-h-12 button with it, and omits undefined slots cleanly', async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <>
        <ListRow title="Static" />
        <ListRow
          title="Very long household title that truncates cleanly"
          description="Wrapping multi-line description copy"
          leading={<span data-testid="lead">L</span>}
          trailing={<span data-testid="trail">T</span>}
          onSelect={onSelect}
          isCurrent
        />
      </>,
    );
    expect(screen.queryByRole('button', { name: /Static/ })).toBeNull();
    const staticRow = screen.getByText('Static').closest('div');
    expect(staticRow).toHaveClass('min-h-12');
    expect(staticRow).not.toHaveClass('overflow-hidden');
    // Only the title column span + inner title span exist when leading/description/trailing are omitted.
    expect(staticRow?.children).toHaveLength(1);

    const row = screen.getByRole('button', { name: /Very long household title/ });
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(row).toHaveClass('min-h-12');
    expect(row).not.toHaveClass('overflow-hidden');
    const titleEl = screen.getByText('Very long household title that truncates cleanly');
    expect(titleEl).toHaveClass('truncate');
    expect(titleEl.parentElement).toHaveClass('min-w-0', 'flex-1');
    expect(container.querySelector('[data-testid="lead"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="trail"]')).toBeInTheDocument();

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
          { value: 'c', label: 'Archive' },
        ]}
        value={value}
        onValueChange={setValue}
      />
    );
  }

  it('moves with roving arrow/Home/End keys, selects with Enter, scrolls active into view, and never clears selection', async () => {
    const scrollIntoView = vi.fn();
    const original: unknown = Reflect.get(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Harness />);
      const radiogroup = screen.getByRole('radiogroup', { name: 'Bills sections' });
      expect(radiogroup).toHaveClass('overflow-x-auto');

      const bills = screen.getByRole('radio', { name: 'Bills' });
      const subscriptions = screen.getByRole('radio', { name: 'Subscriptions' });
      const archive = screen.getByRole('radio', { name: 'Archive' });

      expect(bills).toHaveClass('shrink-0');
      expect(bills.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(subscriptions.querySelector('svg')).toBeNull();

      await userEvent.tab();
      expect(bills).toHaveFocus();
      await userEvent.keyboard('{ArrowRight}');
      expect(subscriptions).toHaveFocus();
      expect(subscriptions).toHaveAttribute('tabindex', '0');
      expect(bills).toHaveAttribute('tabindex', '-1');

      await userEvent.keyboard('{End}');
      expect(archive).toHaveFocus();
      await userEvent.keyboard('{Home}');
      expect(bills).toHaveFocus();
      await userEvent.keyboard('{ArrowLeft}');
      expect(archive).toHaveFocus();

      scrollIntoView.mockClear();
      await userEvent.keyboard('{Enter}');
      expect(archive).toBeChecked();
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });

      // Activating or clicking the already-selected segment leaves it selected.
      await userEvent.keyboard('{Enter}');
      expect(archive).toBeChecked();
      await userEvent.click(archive);
      expect(archive).toBeChecked();
    } finally {
      Reflect.set(Element.prototype, 'scrollIntoView', original);
    }
  });
});

describe('FormMessage', () => {
  it('renders an empty alert region when undefined and preserves <div role="alert"><p> with Icon when set', () => {
    const { container, rerender } = render(<FormMessage message={undefined} />);
    const alert = screen.getByRole('alert');
    expect(alert.querySelector('p')).toBeNull();

    rerender(<FormMessage message="That password is too common. Choose another." />);
    const paragraph = alert.querySelector('p');
    expect(paragraph).not.toBeNull();
    expect(paragraph).toHaveTextContent('That password is too common. Choose another.');
    expect(paragraph?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.max-w-\\[70ch\\]')).toHaveTextContent(
      'That password is too common. Choose another.',
    );
  });
});

describe('CopyButton', () => {
  it('copies text via md-outlined-button with Icon and shows confirmation or clipboard error snackbar', async () => {
    const writeText = vi.fn<(_text: string) => Promise<void>>().mockResolvedValue(undefined);
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    try {
      render(
        <ToastProvider>
          <CopyButton
            label="Copy invite link"
            value="https://hestia.test/join/abc"
            confirmation="Invite link copied."
          />
        </ToastProvider>,
      );

      const button = getMdButton('Copy invite link');
      expect(button.tagName).toBe('MD-OUTLINED-BUTTON');
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

      await userEvent.click(button);
      expect(writeText).toHaveBeenCalledWith('https://hestia.test/join/abc');
      expect(await screen.findByRole('status')).toHaveTextContent('Invite link copied.');
      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      writeText.mockRejectedValueOnce(new Error('Clipboard blocked'));
      await userEvent.click(button);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not copy. Select the text and copy it by hand.',
      );
    } finally {
      if (originalDescriptor !== undefined) {
        Object.defineProperty(navigator, 'clipboard', originalDescriptor);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }
    }
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

  it('switches panels from the keyboard with tabpanel linkage', async () => {
    render(<Harness />);
    const sunTab = getMdTab('Sun');
    const monTab = getMdTab('Mon');
    await waitFor(() => {
      expect(sunTab).toHaveProperty('active', true);
    });
    expect(sunTab.className).toContain('shrink-0');

    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(monTab).toHaveProperty('active', true);
    });
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Monday meals');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(monTab.id);
  });

  it('scrolls the newly active tab into view, from the keyboard and not only a click', async () => {
    const scrollIntoView = vi.fn();
    const original: unknown = Reflect.get(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Harness />);
      await waitFor(() => {
        expect(getMdTab('Sun')).toHaveProperty('active', true);
      });

      scrollIntoView.mockClear();
      await userEvent.tab();
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalled();
      });

      scrollIntoView.mockClear();
      await userEvent.click(getMdTab('Sun'));
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalled();
      });
    } finally {
      Reflect.set(Element.prototype, 'scrollIntoView', original);
    }
  });

  it('falls back to the first tab on an unmatched value and handles empty items', async () => {
    const { rerender } = render(
      <Tabs
        label="Day"
        value="missing"
        onValueChange={vi.fn()}
        items={[
          { value: 'sun', label: 'Sun', content: <p>Sunday meals</p> },
          { value: 'mon', label: 'Mon', content: <p>Monday meals</p> },
        ]}
      />,
    );
    await waitFor(() => {
      expect(getMdTab('Sun')).toHaveProperty('active', true);
    });
    expect(screen.getByText('Sunday meals')).toBeVisible();

    rerender(<Tabs label="Day" value="" onValueChange={vi.fn()} items={[]} />);
    expect(screen.queryByRole('tabpanel')).toBeNull();
  });
});

describe('OverflowMenu', () => {
  it('opens from the keyboard with fixed positioning, preserves order/disabledReason, and runs the chosen action', async () => {
    const onRename = vi.fn();
    const onDisabled = vi.fn();
    const { container } = render(
      <OverflowMenu
        label="More actions for This Week"
        items={[
          { label: 'Rename', onSelect: onRename },
          { label: 'Sync', onSelect: onDisabled, disabledReason: 'Needs a connection.' },
          { label: 'Delete', onSelect: vi.fn(), isDestructive: true },
        ]}
      />,
    );
    const menu = container.querySelector('md-menu');
    expect(menu).toHaveProperty('positioning', 'fixed');
    const trigger = getMdButton('More actions for This Week');
    expect(menu).toHaveProperty('anchor', trigger.id);

    await waitFor(() => {
      expect(trigger.shadowRoot?.querySelector('button')).not.toBeNull();
    });
    trigger.shadowRoot?.querySelector('button')?.focus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(menu).toHaveProperty('open', true);
    });
    const rename = getMdMenuItem(/Rename/);
    const sync = getMdMenuItem(/Sync/);
    expect(sync).toHaveProperty('disabled', true);
    expect(sync).toHaveTextContent('Needs a connection.');
    await userEvent.click(sync);
    expect(onDisabled).not.toHaveBeenCalled();

    await userEvent.click(rename);
    expect(onRename).toHaveBeenCalledOnce();
  });

  it('handles an empty item list cleanly', () => {
    const { container } = render(<OverflowMenu label="Empty menu" items={[]} />);
    expect(getMdButton('Empty menu')).toBeInTheDocument();
    expect(container.querySelectorAll('md-menu-item')).toHaveLength(0);
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

  it('opens via native showModal in the section color and returns focus to its trigger on Escape', async () => {
    const showModalSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Add errand' });
    await userEvent.click(trigger);

    expect(showModalSpy).toHaveBeenCalledTimes(1);
    const dialog = await screen.findByRole('dialog', { name: 'Add errand' });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('data-section', 'chores');

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    showModalSpy.mockRestore();
  });

  it('dismisses via the Close icon button and restores trigger focus', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Add errand' });
    await userEvent.click(trigger);

    await screen.findByRole('dialog', { name: 'Add errand' });
    await userEvent.click(getMdButton('Close'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('handles Safari backdrop fallback without closing on zero-rect stubs and resets returnValue', () => {
    const onOpenChange = vi.fn();
    render(
      <ModalBottomSheet open onOpenChange={onOpenChange} title="Filters">
        <p>Filter options</p>
      </ModalBottomSheet>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog).toBeInstanceOf(HTMLDialogElement);

    // Zero-rect stub should NOT trigger fallback backdrop dismissal.
    fireEvent.pointerDown(dialog, { clientX: 10, clientY: 10, isPrimary: true, button: 0 });
    fireEvent.pointerUp(dialog, { clientX: 10, clientY: 10, isPrimary: true, button: 0 });
    expect(onOpenChange).not.toHaveBeenCalled();

    // Non-zero rect: pointerdown + pointerup outside dialog rect triggers dismissal.
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 400, 320, 400));
    fireEvent.pointerDown(dialog, { clientX: 100, clientY: 100, isPrimary: true, button: 0 });
    fireEvent.pointerUp(dialog, { clientX: 100, clientY: 100, isPrimary: true, button: 0 });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    if (dialog instanceof HTMLDialogElement) {
      dialog.returnValue = 'dismissed';
      fireEvent(dialog, new Event('close'));
      expect(dialog.returnValue).toBe('');
    }
  });
});

describe('ConfirmDialog', () => {
  it('names the consequence, starts focus on Cancel, blocks outside scrim cancel, and confirms', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete This Week?"
        description="Its 15 items are removed permanently."
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />,
    );
    const dialog = getMdDialog('Delete This Week?');
    expect(dialog).toHaveProperty('type', 'alert');
    expect(dialog).toHaveAccessibleDescription('Its 15 items are removed permanently.');

    const cancelButton = getMdButton('Cancel');
    await waitFor(() => {
      expect(cancelButton).toHaveFocus();
    });

    const scrimCancel = new Event('cancel', { cancelable: true });
    act(() => {
      dialog.dispatchEvent(scrimCancel);
    });
    expect(scrimCancel.defaultPrevented).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(getMdButton('Delete'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('closes on Cancel and Escape, and blocks duplicate confirms while confirming', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete Oak Street?"
        description="This deletes 4 lists, 23 recipes, and 6 chores permanently."
        confirmLabel="Delete household"
        onConfirm={onConfirm}
        isConfirmDisabled
      />,
    );
    expect(getMdButton('Delete household')).toHaveProperty('disabled', true);

    await userEvent.click(getMdButton('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    const dialog = getMdDialog('Delete Oak Street?');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete Oak Street?"
        description="This deletes 4 lists, 23 recipes, and 6 chores permanently."
        confirmLabel="Delete household"
        onConfirm={onConfirm}
        isConfirming
      />,
    );
    const confirmButton = getMdButton('Delete household');
    expect(
      confirmButton.getAttribute('aria-busy') ?? confirmButton.getAttribute('data-aria-busy'),
    ).not.toBeNull();
    expect(confirmButton.querySelector('md-circular-progress')).not.toBeNull();
    await userEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(queryMdDialog('Delete Oak Street?')).not.toBeNull();
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
