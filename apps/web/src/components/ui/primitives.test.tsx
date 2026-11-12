import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionProvider } from '../../lib/section-context.tsx';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import {
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
