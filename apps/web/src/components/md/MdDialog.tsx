import { createComponent } from '@lit/react';
import { MdDialog as MdDialogElement } from '@material/web/dialog/dialog.js';
import * as React from 'react';

export const MdDialog = createComponent({
  react: React,
  tagName: 'md-dialog',
  elementClass: MdDialogElement,
  events: {
    onOpen: 'open',
    onOpened: 'opened',
    onClose: 'close',
    onClosed: 'closed',
    onCancel: 'cancel',
  },
});
