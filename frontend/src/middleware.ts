/**
 * Next.js Middleware
 * 
 * Handles authentication and authorization for protected routes.
 * Redirects unauthenticated users to login page.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/bookings',
  '/profile',
];

// Admin-only routes
const adminRoutes = [
  '/admin',
];

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth',
  '/venues',
  '/booking',
  '/event-details',
  '/addons',
  '/payment',
  '/confirmation',
  '/success',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get auth token from cookies or localStorage (client-side will use middleware via headers)
  const authToken = request.cookies.get('auth-token')?.value || 
                   request.headers.get('authorization')?.replace('Bearer ', '');

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

  // Allow public routes without auth
  if (isPublicRoute && !isProtectedRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!authToken) {
    const redirectUrl = new URL('/auth', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // TODO: For admin routes, decode JWT and validate role
  // if (isAdminRoute) {
  //   const payload = decodeJWT(authToken);
  //   if (payload.role !== 'admin') {
  //     return NextResponse.redirect(new URL('/', request.url));
  //   }
  // }

  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
