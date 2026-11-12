import { createComponent } from '@lit/react';
import { MdCircularProgress as MdCircularProgressElement } from '@material/web/progress/circular-progress.js';
import * as React from 'react';

export const MdCircularProgress = createComponent({
  react: React,
  tagName: 'md-circular-progress',
  elementClass: MdCircularProgressElement,
});
