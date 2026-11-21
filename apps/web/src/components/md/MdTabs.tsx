import { createComponent } from '@lit/react';
import { MdPrimaryTab as MdPrimaryTabElement } from '@material/web/tabs/primary-tab.js';
import { MdTabs as MdTabsElement } from '@material/web/tabs/tabs.js';
import * as React from 'react';

export const MdTabs = createComponent({
  react: React,
  tagName: 'md-tabs',
  elementClass: MdTabsElement,
  events: {
    onChange: 'change',
  },
});

export const MdPrimaryTab = createComponent({
  react: React,
  tagName: 'md-primary-tab',
  elementClass: MdPrimaryTabElement,
});
