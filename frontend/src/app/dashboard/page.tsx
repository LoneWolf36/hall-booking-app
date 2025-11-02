/**
 * User Dashboard Page
 * 
 * Shows user's booking history, upcoming events, and management actions.
 * Requires authentication - wrapped with ProtectedRoute.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/stores';
import {
  CalendarDaysIcon,
  MapPinIcon,
  UsersIcon,
  CreditCardIcon,
  ClockIcon,
  PlusIcon,
  EyeIcon,
  DownloadIcon,
  AlertTriangleIcon,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

// Import API services
import { listBookings } from '@/lib/api/bookings';

// Types for booking data
interface BookingItem {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  eventType: string;
  guestCount: number;
  startTs: string;
  endTs: string;
  totalAmountCents: number;
  venue: {
    name: string;
    city: string;
  };
  createdAt: string;
}

interface BookingStats {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
}

function DashboardPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [stats, setStats] = useState<BookingStats>({ total: 0, upcoming: 0, completed: 0, cancelled: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [token]);

  const fetchBookings = async () => {
    if (!token) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await listBookings(
        {
          page: 1,
          limit: 50, // Get more bookings for dashboard
        },
        token
      );
      
      if (response.success && response.data) {
        const bookingData = response.data.data || [];
        setBookings(bookingData);
        
        // Calculate stats
        const now = new Date();
        const stats = bookingData.reduce(
          (acc, booking) => {
            acc.total++;
            
            if (booking.status === 'cancelled') {
              acc.cancelled++;
            } else if (new Date(booking.startTs) > now) {
              acc.upcoming++;
            } else {
              acc.completed++;
            }
            
            return acc;
          },
          { total: 0, upcoming: 0, completed: 0, cancelled: 0 }
        );
        
        setStats(stats);
        console.log('Bookings loaded:', { count: bookingData.length, stats });
      } else {
        throw new Error(response.message || 'Failed to load bookings');
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      setError(error instanceof Error ? error.message : 'Failed to load bookings');
      toast.error('Could not load your bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'temp_hold': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'text-green-600 dark:text-green-400';
      case 'pending': return 'text-yellow-600 dark:text-yellow-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getDaysUntilEvent = (startDate: string) => {
    const eventDate = new Date(startDate);
    const today = new Date();
    return differenceInDays(eventDate, today);
  };

  const handleViewBooking = (bookingId: string) => {
    // Navigate to booking details (future implementation)
    toast.info('Booking details view coming soon');
  };

  const handleNewBooking = () => {
    router.push('/booking');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your bookings..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-6 sm:py-8 px-3 sm:px-4">
      <div className="container max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">My Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back, {user?.name || 'Guest'}! Manage your bookings here.
            </p>
          </div>
          <Button 
            onClick={handleNewBooking}
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg hover:shadow-xl transition-all duration-300"
            size="lg"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            New Booking
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.total}
                </p>
                <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 font-medium">
                  Total Bookings
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.upcoming}
                </p>
                <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-medium">
                  Upcoming Events
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.completed}
                </p>
                <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 font-medium">
                  Completed
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 border-gray-200 dark:border-gray-800">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-gray-600 dark:text-gray-400">
                  {stats.cancelled}
                </p>
                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">
                  Cancelled
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchBookings} 
                className="ml-3"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Bookings List */}
        {bookings.length === 0 && !error ? (
          <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl">
            <CardContent className="text-center py-12">
              <CalendarDaysIcon className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Bookings Yet</h3>
              <p className="text-muted-foreground mb-6">
                You haven't made any bookings yet. Start by browsing available venues.
              </p>
              <Button onClick={handleNewBooking} size="lg">
                <PlusIcon className="mr-2 h-4 w-4" />
                Make Your First Booking
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-2xl border-border/40 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDaysIcon className="h-5 w-5" />
                Your Bookings
              </CardTitle>
              <CardDescription>
                Manage your upcoming and past events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bookings.map((booking) => {
                const daysUntil = getDaysUntilEvent(booking.startTs);
                const isUpcoming = daysUntil >= 0;
                const eventDate = new Date(booking.startTs);
                
                return (
                  <Card key={booking.id} className="border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-md">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Left: Booking Details */}
                        <div className="space-y-3 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <h3 className="font-semibold text-lg">
                              {booking.venue.name}
                            </h3>
                            <div className="flex gap-2">
                              <Badge className={getStatusColor(booking.status)}>
                                {booking.status.replace('_', ' ')}
                              </Badge>
                              {isUpcoming && daysUntil <= 7 && (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  {daysUntil === 0 ? 'Today' : `${daysUntil} days`}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <CalendarDaysIcon className="h-3 w-3" />
                              {format(eventDate, 'MMM d, yyyy')}
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <UsersIcon className="h-3 w-3" />
                              {booking.guestCount} guests
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPinIcon className="h-3 w-3" />
                              {booking.venue.city}
                            </div>
                            <div className={`flex items-center gap-1 ${getPaymentStatusColor(booking.paymentStatus)}`}>
                              <CreditCardIcon className="h-3 w-3" />
                              ₹{(booking.totalAmountCents / 100).toLocaleString()}
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            Booking #{booking.bookingNumber} • {format(new Date(booking.createdAt), 'MMM d, yyyy')}
                          </div>
                        </div>
                        
                        {/* Right: Actions */}
                        <div className="flex flex-row sm:flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewBooking(booking.id)}
                            className="flex-1 sm:flex-none"
                          >
                            <EyeIcon className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          
                          {booking.status === 'confirmed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toast.info('Receipt download coming soon')}
                              className="flex-1 sm:flex-none"
                            >
                              <DownloadIcon className="h-3 w-3 mr-1" />
                              Receipt
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Upcoming Event Alert */}
                      {isUpcoming && daysUntil <= 3 && daysUntil >= 0 && (
                        <Alert className="mt-4 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
                          <ClockIcon className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-800 dark:text-orange-200">
                            {daysUntil === 0 
                              ? 'Your event is today! Contact the venue if you have any last-minute questions.'
                              : `Your event is in ${daysUntil} day${daysUntil > 1 ? 's' : ''}. Make sure to confirm all details with the venue.`
                            }
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function ProtectedDashboardPage() {
  return (
    <ProtectedRoute requireAuth>
      <DashboardPage />
    </ProtectedRoute>
  );
}