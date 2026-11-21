import { createComponent } from '@lit/react';
import { MdFab as MdFabElement } from '@material/web/fab/fab.js';
import * as React from 'react';

export const MdFab = createComponent({
  react: React,
  tagName: 'md-fab',
  elementClass: MdFabElement,
});
