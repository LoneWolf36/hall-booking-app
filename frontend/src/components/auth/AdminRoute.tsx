/**
 * Admin Route Guard
 * 
 * Protects admin-only routes from unauthorized access.
 * Redirects non-admin users to homepage.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please login to access admin panel');
      router.push('/auth?redirect=/admin');
      return;
    }

    if (user?.role !== 'admin') {
      toast.error('Unauthorized access. Admin privileges required.');
      router.push('/');
      return;
    }
  }, [isAuthenticated, user, router]);

  // Show nothing while checking auth
  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}
