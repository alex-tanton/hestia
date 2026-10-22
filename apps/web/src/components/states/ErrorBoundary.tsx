import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Rendered in place of the children after a render error; `reset` retries them. */
  fallback: (reset: () => void) => ReactNode;
  /** Hook for client error reporting. */
  onError?: (error: unknown, info: ErrorInfo) => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * The one class component in the app: React can only catch render errors in a class
 * (`getDerivedStateFromError` has no hook equivalent). It scopes a failure to its region, so
 * one broken dashboard card never blanks the others.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private readonly reset = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback(this.reset) : this.props.children;
  }
}
