/**
 * Error Boundary Component
 * 
 * Catches errors from child components and displays fallback UI.
 * Logs error details for debugging.
 */

'use client';

import { ReactNode, Component, ErrorInfo } from 'react';
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error);
      console.error('Error info:', errorInfo);
    }

    // You can also log to error reporting service here
    // e.g., Sentry, LogRocket, etc.
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error, this.resetError)
      ) : (
        <ErrorFallback error={this.state.error} reset={this.resetError} />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-x-hidden">
      <Card className="w-full max-w-md backdrop-blur-xl bg-slate-900/40 border-slate-700/30 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 backdrop-blur-md border border-red-400/30">
            <AlertTriangleIcon className="h-6 w-6 text-red-400" />
          </div>
          <CardTitle className="text-2xl text-red-400">Something Went Wrong</CardTitle>
          <CardDescription>We encountered an unexpected error</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-slate-950/50 border border-red-500/20 rounded-lg p-4 space-y-2">
              <p className="text-xs font-mono text-red-300 break-words">
                {error.message}
              </p>
              {error.stack && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">Stack trace</summary>
                  <pre className="mt-2 overflow-auto max-h-40 bg-slate-950 p-2 rounded text-red-300/70 font-mono text-xs">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Please try refreshing the page or contact support if the problem persists.
          </p>
          <Button onClick={reset} size="lg" className="w-full">
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
