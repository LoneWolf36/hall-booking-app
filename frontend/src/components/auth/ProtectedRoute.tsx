/**
 * Protected Route Component
 * 
 * Wraps components that require authentication.
 * Redirects unauthenticated users to login page.
 * Supports role-based access control.
 */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'customer';
  redirectTo?: string;
}

/**
 * HOC that protects routes from unauthenticated access
 */
export function ProtectedRoute({ 
  children, 
  requiredRole,
  redirectTo 
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, isLoading } = useAuthStore();
  
  useEffect(() => {
    // Don't redirect during SSR or initial hydration
    if (typeof window === 'undefined') return;
    
    // Don't redirect while loading
    if (isLoading) return;
    
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      const loginUrl = redirectTo || `/auth?redirect=${encodeURIComponent(pathname)}`;
      router.push(loginUrl);
      return;
    }
    
    // Role-based access control
    if (requiredRole && user?.role !== requiredRole) {
      router.push('/unauthorized');
      return;
    }
  }, [isAuthenticated, user, isLoading, router, pathname, requiredRole, redirectTo]);
  
  // Show loading during authentication check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Show nothing while redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Role check
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

/**
 * Hook to check if user has required role
 */
export function useRequireAuth(requiredRole?: 'admin' | 'customer') {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return { hasAccess: false, reason: 'not_authenticated' };
  }
  
  if (requiredRole && user?.role !== requiredRole) {
    return { hasAccess: false, reason: 'insufficient_role' };
  }
  
  return { hasAccess: true };
}

/**
 * Higher-order component for protecting pages
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: 'admin' | 'customer'
) {
  const ProtectedComponent = (props: P) => {
    return (
      <ProtectedRoute requiredRole={requiredRole}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
  
  ProtectedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;
  
  return ProtectedComponent;
}