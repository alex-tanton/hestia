import { createComponent } from '@lit/react';
import { MdOutlinedTextField as MdOutlinedTextFieldElement } from '@material/web/textfield/outlined-text-field.js';
import * as React from 'react';

export const MdOutlinedTextField = createComponent({
  react: React,
  tagName: 'md-outlined-text-field',
  elementClass: MdOutlinedTextFieldElement,
  events: {
    onInput: 'input',
    onChange: 'change',
  },
});
