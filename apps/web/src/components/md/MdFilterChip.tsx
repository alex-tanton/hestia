import { createComponent } from '@lit/react';
import { MdFilterChip as MdFilterChipElement } from '@material/web/chips/filter-chip.js';
import * as React from 'react';

export const MdFilterChip = createComponent({
  react: React,
  tagName: 'md-filter-chip',
  elementClass: MdFilterChipElement,
  events: {
    onChange: 'change',
    onInput: 'input',
  },
});
