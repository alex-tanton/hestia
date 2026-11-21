import { createComponent } from '@lit/react';
import { MdCheckbox as MdCheckboxElement } from '@material/web/checkbox/checkbox.js';
import * as React from 'react';

export const MdCheckbox = createComponent({
  react: React,
  tagName: 'md-checkbox',
  elementClass: MdCheckboxElement,
  events: {
    onInput: 'input',
    onChange: 'change',
  },
});
