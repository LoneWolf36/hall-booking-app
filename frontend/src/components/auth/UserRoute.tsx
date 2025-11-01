/**
 * User Route Guard
 * 
 * Protects authenticated routes from unauthenticated access.
 * Redirects to login if not authenticated.
 */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

interface UserRouteProps {
  children: React.ReactNode;
}

export function UserRoute({ children }: UserRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please login to continue');
      router.push(`/auth?redirect=${pathname}`);
      return;
    }
  }, [isAuthenticated, pathname, router]);

  // Show nothing while checking auth
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
