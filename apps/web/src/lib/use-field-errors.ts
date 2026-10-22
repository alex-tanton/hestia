import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface FieldErrors<F extends string> {
  errors: Partial<Record<F, string>>;
  /** Replaces the whole set and moves focus to the first field still in error. */
  setErrors: (next: Partial<Record<F, string>>) => void;
  formRef: RefObject<HTMLFormElement | null>;
}

/**
 * Form errors that are announced and reachable: each message is rendered by the field (which
 * links it with `aria-describedby` and marks the control `aria-invalid`), and on submit focus
 * moves to the first field in error.
 */
export function useFieldErrors<F extends string>(): FieldErrors<F> {
  const [errors, setErrorsState] = useState<Partial<Record<F, string>>>({});
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (attempt === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt, errors]);

  const setErrors = useCallback((next: Partial<Record<F, string>>) => {
    setErrorsState(next);
    setAttempt((count) => count + 1);
  }, []);

  return { errors, setErrors, formRef };
}
