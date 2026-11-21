import type { KeyboardEvent, ReactElement, Ref } from 'react';
import { NativePickerField, type FieldChangeEvent, type FieldMessages } from './Field.tsx';

export interface TimeFieldProps extends FieldMessages {
  value?: string | undefined;
  defaultValue?: string | undefined;
  name?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  min?: string | number | undefined;
  max?: string | number | undefined;
  step?: string | number | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
  ref?: Ref<HTMLElement> | undefined;
  onChange?: ((event: FieldChangeEvent) => void) | undefined;
  onKeyDown?: ((event: KeyboardEvent<HTMLElement>) => void) | undefined;
}

export function TimeField(props: TimeFieldProps): ReactElement {
  return <NativePickerField {...props} type="time" />;
}
