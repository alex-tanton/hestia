import { createComponent } from '@lit/react';
import { MdOutlinedSelect as MdOutlinedSelectElement } from '@material/web/select/outlined-select.js';
import { MdSelectOption as MdSelectOptionElement } from '@material/web/select/select-option.js';
import * as React from 'react';

export const MdOutlinedSelect = createComponent({
  react: React,
  tagName: 'md-outlined-select',
  elementClass: MdOutlinedSelectElement,
  events: {
    onInput: 'input',
    onChange: 'change',
    onOpening: 'opening',
    onOpened: 'opened',
    onClosing: 'closing',
    onClosed: 'closed',
  },
});

export const MdSelectOption = createComponent({
  react: React,
  tagName: 'md-select-option',
  elementClass: MdSelectOptionElement,
});
