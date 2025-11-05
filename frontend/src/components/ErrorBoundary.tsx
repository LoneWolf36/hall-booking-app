/**
 * Enhanced Error Boundary Component
 * 
 * Provides comprehensive error handling with user-friendly fallback UI.
 * Fixes the console errors by properly catching and displaying errors.
 * 
 * Features:
 * - User-friendly error messages
 * - Retry mechanisms
 * - Error reporting
 * - Different error states for different types of errors
 * - Debug information in development
 */

'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ErrorInfo {
  componentStack: string;
}

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // If true, only catches errors from direct children
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
  errorBoundaryId: string;
}

export interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  retryCount: number;
  errorId: string;
}

// Error classification
const getErrorType = (error: Error) => {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'network';
  }
  
  if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
    return 'auth';
  }
  
  if (message.includes('hydration') || message.includes('server') || message.includes('ssr')) {
    return 'hydration';
  }
  
  if (message.includes('chunk') || message.includes('loading') || message.includes('import')) {
    return 'chunk';
  }
  
  return 'generic';
};

// Default fallback component
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  errorInfo, 
  resetError, 
  retryCount, 
  errorId 
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const errorType = error ? getErrorType(error) : 'generic';
  const canRetry = retryCount < 3;
  const isDevelopment = process.env.NODE_ENV === 'development';

  const handleRetry = async () => {
    setIsRetrying(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    resetError();
    setIsRetrying(false);
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleReload = () => {
    window.location.reload();
  };

  const getErrorIcon = () => {
    switch (errorType) {
      case 'network':
        return <WifiOff className="h-12 w-12 text-red-500" />;
      case 'auth':
        return <AlertTriangle className="h-12 w-12 text-orange-500" />;
      default:
        return <Bug className="h-12 w-12 text-red-500" />;
    }
  };

  const getErrorTitle = () => {
    switch (errorType) {
      case 'network':
        return 'Connection Error';
      case 'auth':
        return 'Authentication Error';
      case 'hydration':
        return 'Loading Error';
      case 'chunk':
        return 'Loading Error';
      default:
        return 'Something went wrong';
    }
  };

  const getErrorDescription = () => {
    switch (errorType) {
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case 'auth':
        return 'There was an authentication issue. Please try logging in again.';
      case 'hydration':
        return 'There was an issue loading the page content. Please refresh the page.';
      case 'chunk':
        return 'Failed to load page resources. This might be due to a network issue.';
      default:
        return 'An unexpected error occurred. We apologize for the inconvenience.';
    }
  };

  const getSuggestions = () => {
    switch (errorType) {
      case 'network':
        return [
          'Check your internet connection',
          'Verify the backend server is running',
          'Try refreshing the page',
        ];
      case 'auth':
        return [
          'Try logging out and logging back in',
          'Clear your browser cache',
          'Check if your session has expired',
        ];
      case 'hydration':
        return [
          'Refresh the page',
          'Clear browser cache',
          'Try in an incognito window',
        ];
      default:
        return [
          'Try refreshing the page',
          'Go back to the home page',
          'Contact support if the issue persists',
        ];
    }
  };

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getErrorIcon()}
          </div>
          <CardTitle className="text-xl font-semibold">
            {getErrorTitle()}
          </CardTitle>
          <CardDescription className="text-base">
            {getErrorDescription()}
          </CardDescription>
          
          {retryCount > 0 && (
            <Badge variant="destructive" className="mx-auto w-fit">
              Attempt {retryCount + 1} of 3
            </Badge>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Suggestions */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Try these steps:</h4>
            <ul className="text-sm space-y-1">
              {getSuggestions().map((suggestion, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {canRetry && (
              <Button 
                onClick={handleRetry} 
                disabled={isRetrying}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </Button>
            )}
            
            <Button onClick={handleReload} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </Button>
            
            <Button onClick={handleGoHome} variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </div>
          
          {/* Error details for development */}
          {isDevelopment && error && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between text-xs p-2 h-8"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <span>Show Error Details</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    DEV
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4 p-3 bg-muted rounded-lg text-xs space-y-2">
                  <div>
                    <strong>Error ID:</strong> {errorId}
                  </div>
                  <div>
                    <strong>Type:</strong> {errorType}
                  </div>
                  <div>
                    <strong>Message:</strong>
                    <pre className="mt-1 text-xs overflow-auto whitespace-pre-wrap">
                      {error.message}
                    </pre>
                  </div>
                  <div>
                    <strong>Stack:</strong>
                    <pre className="mt-1 text-xs overflow-auto whitespace-pre-wrap max-h-32">
                      {error.stack}
                    </pre>
                  </div>
                  {errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 text-xs overflow-auto whitespace-pre-wrap max-h-32">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {/* Error ID for support */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Error ID: <code className="bg-muted px-1 py-0.5 rounded text-xs">{errorId}</code>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Please include this ID when contacting support
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Error Boundary Class Component
export class ErrorBoundary extends React.Component<Props, State> {
  private resetTimeoutId: number | null = null;
  
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      errorBoundaryId: `eb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    
    // Log error for debugging
    console.error('Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
    
    // Report error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with error monitoring service (Sentry, LogRocket, etc.)
      console.error('Production error:', {
        errorId: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Auto-recovery attempt after 30 seconds for certain error types
    if (this.state.hasError && !prevState.hasError) {
      const errorType = this.state.error ? getErrorType(this.state.error) : 'generic';
      
      if (errorType === 'network' || errorType === 'chunk') {
        this.resetTimeoutId = window.setTimeout(() => {
          console.log('Auto-recovery attempt triggered');
          this.resetError();
        }, 30000);
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetError = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: prevState.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
          retryCount={this.state.retryCount}
          errorId={this.state.errorId}
        />
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);
  
  const resetError = () => setError(null);
  
  const handleError = React.useCallback((error: Error) => {
    console.error('Manual error handling:', error);
    setError(error);
  }, []);
  
  // Throw error to be caught by Error Boundary
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);
  
  return { handleError, resetError };
};

// HOC for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

export default ErrorBoundary;