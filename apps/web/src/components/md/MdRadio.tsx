import { createComponent } from '@lit/react';
import { MdRadio as MdRadioElement } from '@material/web/radio/radio.js';
import * as React from 'react';

export const MdRadio = createComponent({
  react: React,
  tagName: 'md-radio',
  elementClass: MdRadioElement,
  events: {
    onInput: 'input',
    onChange: 'change',
  },
});
