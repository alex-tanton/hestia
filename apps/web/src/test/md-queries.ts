import { waitFor } from '@testing-library/react';

export type TextMatcher = string | RegExp;

export interface MdQueryOptions {
  container?: HTMLElement | undefined;
  name?: TextMatcher | undefined;
  includeClosed?: boolean | undefined;
}

interface ResolvedQueryOptions {
  container: HTMLElement;
  name?: TextMatcher | undefined;
  includeClosed: boolean;
}

interface MdWidgetSpec {
  label: string;
  selector: string;
  includeTextContent: boolean;
}

export interface MdHostQueries {
  query: (
    nameOrOptions?: TextMatcher | MdQueryOptions,
    options?: MdQueryOptions,
  ) => HTMLElement | null;
  get: (nameOrOptions?: TextMatcher | MdQueryOptions, options?: MdQueryOptions) => HTMLElement;
  find: (
    nameOrOptions?: TextMatcher | MdQueryOptions,
    options?: MdQueryOptions,
  ) => Promise<HTMLElement>;
}

const BUTTON_SELECTOR = [
  'md-filled-button',
  'md-outlined-button',
  'md-text-button',
  'md-elevated-button',
  'md-filled-tonal-button',
  'md-icon-button',
  'md-filled-icon-button',
  'md-filled-tonal-icon-button',
  'md-outlined-icon-button',
  'md-fab',
  'md-suggestion-chip',
  'button',
].join(', ');

const FIELD_SELECTOR = [
  'md-outlined-text-field',
  'md-filled-text-field',
  'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])',
  'textarea',
].join(', ');

const SELECT_SELECTOR = 'md-outlined-select, md-filled-select, select';
const CHECKBOX_SELECTOR = 'md-checkbox, input[type="checkbox"]:not([role="switch"])';
const SWITCH_SELECTOR = 'md-switch, button[role="switch"], input[type="checkbox"][role="switch"]';
const DIALOG_SELECTOR = 'md-dialog, dialog, [role="dialog"], [role="alertdialog"]';
const MENU_ITEM_SELECTOR = 'md-menu-item, [role="menuitem"]';
const TAB_SELECTOR = 'md-primary-tab, md-secondary-tab, [role="tab"]';

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function resolveElementById(contextElement: Element, id: string): HTMLElement | null {
  const root = contextElement.getRootNode();
  if (root instanceof Document || root instanceof ShadowRoot) {
    const found = root.getElementById(id);
    if (found instanceof HTMLElement) {
      return found;
    }
  }
  const docFound = contextElement.ownerDocument.getElementById(id);
  return docFound instanceof HTMLElement ? docFound : null;
}

function readLabelledByText(element: Element): string {
  const ids = normalizeText(element.getAttribute('aria-labelledby'));
  if (ids === '') {
    return '';
  }
  return ids
    .split(' ')
    .map((id) => normalizeText(resolveElementById(element, id)?.textContent))
    .filter((part) => part !== '')
    .join(' ');
}

function readExternalLabelText(element: HTMLElement): string {
  if (element.id !== '') {
    const labels = element.ownerDocument.querySelectorAll('label[for]');
    for (const label of labels) {
      if (label.getAttribute('for') === element.id) {
        const text = normalizeText(label.textContent);
        if (text !== '') {
          return text;
        }
      }
    }
  }
  const wrappingLabel = element.closest('label');
  return normalizeText(wrappingLabel?.textContent);
}

function readHeadlineSlotText(element: HTMLElement): string {
  const parts: string[] = [];
  for (const child of element.children) {
    if (child.getAttribute('slot') === 'headline') {
      const text = normalizeText(child.textContent);
      if (text !== '') {
        parts.push(text);
      }
    }
  }
  return parts.join(' ');
}

function readShadowLabelText(element: HTMLElement): string {
  const root = element.shadowRoot;
  if (root === null) {
    return '';
  }
  const labeled = root.querySelector(
    'dialog[aria-label], button[aria-label], input[aria-label], textarea[aria-label], select[aria-label], [role="button"][aria-label], [aria-label]',
  );
  const direct = normalizeText(labeled?.getAttribute('aria-label'));
  if (direct !== '') {
    return direct;
  }
  const labelledByTarget = root.querySelector('dialog[aria-labelledby], [aria-labelledby]');
  if (labelledByTarget !== null) {
    const referenced = readLabelledByText(labelledByTarget);
    if (referenced !== '') {
      return referenced;
    }
  }
  return normalizeText(root.querySelector('.label')?.textContent);
}

/** Resolves the accessible name of an MD custom-element host or light-DOM control. */
export function getMdAccessibleName(element: HTMLElement, includeTextContent = true): string {
  const ariaLabelAttr = normalizeText(element.getAttribute('aria-label'));
  if (ariaLabelAttr !== '') {
    return ariaLabelAttr;
  }
  if ('ariaLabel' in element && typeof element.ariaLabel === 'string') {
    const ariaLabelProp = normalizeText(element.ariaLabel);
    if (ariaLabelProp !== '') {
      return ariaLabelProp;
    }
  }
  const labelledBy = readLabelledByText(element);
  if (labelledBy !== '') {
    return labelledBy;
  }
  const labelAttr = normalizeText(element.getAttribute('label'));
  if (labelAttr !== '') {
    return labelAttr;
  }
  if ('label' in element && typeof element.label === 'string') {
    const labelProp = normalizeText(element.label);
    if (labelProp !== '') {
      return labelProp;
    }
  }
  const externalLabel = readExternalLabelText(element);
  if (externalLabel !== '') {
    return externalLabel;
  }
  const headlineSlot = readHeadlineSlotText(element);
  if (headlineSlot !== '') {
    return headlineSlot;
  }
  const shadowLabel = readShadowLabelText(element);
  if (shadowLabel !== '') {
    return shadowLabel;
  }
  return includeTextContent ? normalizeText(element.textContent) : '';
}

function resolveQueryArgs(
  nameOrOptions?: TextMatcher | MdQueryOptions,
  maybeOptions?: MdQueryOptions,
): ResolvedQueryOptions {
  if (typeof nameOrOptions === 'string' || nameOrOptions instanceof RegExp) {
    return {
      container: maybeOptions?.container ?? document.body,
      name: nameOrOptions,
      includeClosed: maybeOptions?.includeClosed ?? false,
    };
  }
  return {
    container: nameOrOptions?.container ?? document.body,
    name: nameOrOptions?.name,
    includeClosed: nameOrOptions?.includeClosed ?? false,
  };
}

function matchesTextMatcher(candidate: string, matcher: TextMatcher): boolean {
  if (typeof matcher === 'string') {
    return candidate === normalizeText(matcher);
  }
  if (matcher.global || matcher.sticky) {
    matcher.lastIndex = 0;
  }
  return matcher.test(candidate);
}

function isExposedHost(element: HTMLElement, includeClosed: boolean): boolean {
  if (element.hasAttribute('hidden') || element.closest('[hidden]') !== null) {
    return false;
  }
  if (includeClosed) {
    return true;
  }
  const parentMenu = element.closest('md-menu');
  if (parentMenu !== null && !parentMenu.hasAttribute('open')) {
    return false;
  }
  if (
    (element.localName === 'md-dialog' || element.localName === 'dialog') &&
    !element.hasAttribute('open')
  ) {
    return false;
  }
  return true;
}

function findMatchingHosts(spec: MdWidgetSpec, options: ResolvedQueryOptions): HTMLElement[] {
  const candidates = Array.from(
    options.container.querySelectorAll<HTMLElement>(spec.selector),
  ).filter((element) => isExposedHost(element, options.includeClosed));
  if (options.name === undefined) {
    return candidates;
  }
  const matcher = options.name;
  return candidates.filter((element) =>
    matchesTextMatcher(getMdAccessibleName(element, spec.includeTextContent), matcher),
  );
}

function formatHostCandidates(spec: MdWidgetSpec, container: HTMLElement): string {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(spec.selector));
  if (candidates.length === 0) {
    return 'none present';
  }
  return candidates
    .map((el) => `<${el.localName}>("${getMdAccessibleName(el, spec.includeTextContent)}")`)
    .join(', ');
}

function createHostQueries(spec: MdWidgetSpec): MdHostQueries {
  const query = (
    nameOrOptions?: TextMatcher | MdQueryOptions,
    options?: MdQueryOptions,
  ): HTMLElement | null => {
    const resolved = resolveQueryArgs(nameOrOptions, options);
    const matches = findMatchingHosts(spec, resolved);
    if (matches.length > 1) {
      throw new Error(
        `Found ${String(matches.length)} matching ${spec.label} hosts for ${String(resolved.name ?? '*')}.`,
      );
    }
    return matches[0] ?? null;
  };

  const get = (
    nameOrOptions?: TextMatcher | MdQueryOptions,
    options?: MdQueryOptions,
  ): HTMLElement => {
    const resolved = resolveQueryArgs(nameOrOptions, options);
    const match = query(resolved);
    if (match === null) {
      const candidates = formatHostCandidates(spec, resolved.container);
      throw new Error(
        `Unable to find ${spec.label} host matching ${String(resolved.name ?? '*')}. Found: ${candidates}`,
      );
    }
    return match;
  };

  const find = (
    nameOrOptions?: TextMatcher | MdQueryOptions,
    options?: MdQueryOptions,
  ): Promise<HTMLElement> => waitFor(() => get(nameOrOptions, options));

  return { query, get, find };
}

const buttonQueries = createHostQueries({
  label: 'Button',
  selector: BUTTON_SELECTOR,
  includeTextContent: true,
});
const fieldQueries = createHostQueries({
  label: 'Field',
  selector: FIELD_SELECTOR,
  includeTextContent: false,
});
const selectQueries = createHostQueries({
  label: 'Select',
  selector: SELECT_SELECTOR,
  includeTextContent: false,
});
const checkboxQueries = createHostQueries({
  label: 'Checkbox',
  selector: CHECKBOX_SELECTOR,
  includeTextContent: false,
});
const switchQueries = createHostQueries({
  label: 'Switch',
  selector: SWITCH_SELECTOR,
  includeTextContent: false,
});
const dialogQueries = createHostQueries({
  label: 'Dialog',
  selector: DIALOG_SELECTOR,
  includeTextContent: false,
});
const menuItemQueries = createHostQueries({
  label: 'MenuItem',
  selector: MENU_ITEM_SELECTOR,
  includeTextContent: true,
});
const tabQueries = createHostQueries({
  label: 'Tab',
  selector: TAB_SELECTOR,
  includeTextContent: true,
});

export const queryMdButton: MdHostQueries['query'] = buttonQueries.query;
export const getMdButton: MdHostQueries['get'] = buttonQueries.get;
export const findMdButton: MdHostQueries['find'] = buttonQueries.find;

export const queryMdField: MdHostQueries['query'] = fieldQueries.query;
export const getMdField: MdHostQueries['get'] = fieldQueries.get;
export const findMdField: MdHostQueries['find'] = fieldQueries.find;

export const getMdSelect: MdHostQueries['get'] = selectQueries.get;

export const queryMdCheckbox: MdHostQueries['query'] = checkboxQueries.query;
export const getMdCheckbox: MdHostQueries['get'] = checkboxQueries.get;
export const findMdCheckbox: MdHostQueries['find'] = checkboxQueries.find;

export const queryMdSwitch: MdHostQueries['query'] = switchQueries.query;
export const getMdSwitch: MdHostQueries['get'] = switchQueries.get;
export const findMdSwitch: MdHostQueries['find'] = switchQueries.find;

export const queryMdDialog: MdHostQueries['query'] = dialogQueries.query;
export const getMdDialog: MdHostQueries['get'] = dialogQueries.get;
export const findMdDialog: MdHostQueries['find'] = dialogQueries.find;

export const queryMdMenuItem: MdHostQueries['query'] = menuItemQueries.query;
export const getMdMenuItem: MdHostQueries['get'] = menuItemQueries.get;
export const findMdMenuItem: MdHostQueries['find'] = menuItemQueries.find;

export const queryMdTab: MdHostQueries['query'] = tabQueries.query;
export const getMdTab: MdHostQueries['get'] = tabQueries.get;
export const findMdTab: MdHostQueries['find'] = tabQueries.find;
