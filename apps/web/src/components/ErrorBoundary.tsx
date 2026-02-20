import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error boundary caught an error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted px-6 text-center">
          <h1 className="text-2xl font-semibold mb-4">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">
            The app hit an unexpected error. Try refreshing the page or come back later.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-white shadow-sm hover:bg-primary/90"
          >
            Reload app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
