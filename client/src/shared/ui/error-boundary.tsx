import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly fallback: (error: Error) => ReactNode;
  readonly onError?: (error: Error, info: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  readonly error: Error | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}
