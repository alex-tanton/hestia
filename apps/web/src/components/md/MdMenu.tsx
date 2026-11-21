import { createComponent } from '@lit/react';
import { MdMenuItem as MdMenuItemElement } from '@material/web/menu/menu-item.js';
import { MdMenu as MdMenuElement } from '@material/web/menu/menu.js';
import * as React from 'react';

export const MdMenu = createComponent({
  react: React,
  tagName: 'md-menu',
  elementClass: MdMenuElement,
  events: {
    onOpening: 'opening',
    onOpened: 'opened',
    onClosing: 'closing',
    onClosed: 'closed',
  },
});

export const MdMenuItem = createComponent({
  react: React,
  tagName: 'md-menu-item',
  elementClass: MdMenuItemElement,
  events: {
    onCloseMenu: 'close-menu',
  },
});
