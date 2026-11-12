import { createComponent } from '@lit/react';
import { MdSwitch as MdSwitchElement } from '@material/web/switch/switch.js';
import * as React from 'react';

export const MdSwitch = createComponent({
  react: React,
  tagName: 'md-switch',
  elementClass: MdSwitchElement,
  events: {
    onInput: 'input',
    onChange: 'change',
  },
});
