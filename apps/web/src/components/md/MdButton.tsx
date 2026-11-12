import { createComponent } from '@lit/react';
import { MdFilledButton as MdFilledButtonElement } from '@material/web/button/filled-button.js';
import { MdOutlinedButton as MdOutlinedButtonElement } from '@material/web/button/outlined-button.js';
import { MdTextButton as MdTextButtonElement } from '@material/web/button/text-button.js';
import { MdIconButton as MdIconButtonElement } from '@material/web/iconbutton/icon-button.js';
import * as React from 'react';

export const MdFilledButton = createComponent({
  react: React,
  tagName: 'md-filled-button',
  elementClass: MdFilledButtonElement,
});

export const MdOutlinedButton = createComponent({
  react: React,
  tagName: 'md-outlined-button',
  elementClass: MdOutlinedButtonElement,
});

export const MdTextButton = createComponent({
  react: React,
  tagName: 'md-text-button',
  elementClass: MdTextButtonElement,
});

export const MdIconButton = createComponent({
  react: React,
  tagName: 'md-icon-button',
  elementClass: MdIconButtonElement,
  events: {
    onInput: 'input',
    onChange: 'change',
  },
});
