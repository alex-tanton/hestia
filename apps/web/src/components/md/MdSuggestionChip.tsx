import { createComponent } from '@lit/react';
import { MdSuggestionChip as MdSuggestionChipElement } from '@material/web/chips/suggestion-chip.js';
import * as React from 'react';

export const MdSuggestionChip = createComponent({
  react: React,
  tagName: 'md-suggestion-chip',
  elementClass: MdSuggestionChipElement,
  events: {
    onClick: 'click',
  },
});
