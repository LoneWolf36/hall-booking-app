'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBookingStore } from '@/stores';
import {
  CheckCircleIcon,
  DownloadIcon,
  ShareIcon,
  CalendarDaysIcon,
  UsersIcon,
  MapPinIcon,
  CreditCardIcon,
  MailIcon,
  HomeIcon,
} from 'lucide-react';
import { formatDateFull } from '@/lib/dates';

export default function SuccessPage() {
  const router = useRouter();
  const { selectedVenue, selectedDate, eventType, guestCount, paymentMethod } = useBookingStore();
  const [bookingNumber] = useState<string>(`BK${Math.random().toString(36).substring(2, 10).toUpperCase()}`);

  useEffect(() => {
    if (!selectedVenue || !eventType) {
      router.push('/');
    }
  }, [selectedVenue, eventType, router]);

  if (!selectedVenue || !eventType || !selectedDate) {
    return null;
  }

  // Calculate pricing - NO DISCOUNT
  const basePrice = selectedVenue.basePriceCents || 0;
  const subtotal = basePrice / 100;
  const taxes = Math.round(subtotal * 0.18 * 100) / 100;
  const finalAmount = subtotal + taxes;

  const handleDownloadReceipt = () => {
    alert('Receipt download functionality would be implemented here');
  };

  const handleShareBooking = (platform: 'whatsapp' | 'email') => {
    const message = `I have booked ${selectedVenue.name} for my event on ${formatDateFull(selectedDate)}. Booking Reference: ${bookingNumber}`;
    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    } else if (platform === 'email') {
      window.open(`mailto:?subject=My Event Booking - ${bookingNumber}&body=${encodeURIComponent(message)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 to-background dark:from-green-950/20 py-6 sm:py-8 px-3 sm:px-4 overflow-x-hidden">
      <div className="container max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4 pt-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-green-400/20 rounded-full blur-2xl" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-2xl">
                <CheckCircleIcon className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-foreground">Booking Confirmed!</h1>
          <p className="text-lg text-muted-foreground">Your event is all set. We'll see you soon!</p>
        </div>

        <Card className="bg-gradient-to-br from-green-50 dark:from-green-950/40 to-green-50/50 dark:to-green-900/20 border-green-200 dark:border-green-800/40 shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground font-medium">BOOKING REFERENCE</p>
              <p className="text-3xl font-bold font-mono text-green-700 dark:text-green-400 tracking-widest">{bookingNumber}</p>
              <p className="text-sm text-muted-foreground">Confirmation email has been sent to your registered email address</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPinIcon className="h-5 w-5 text-primary" />Event Venue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Venue Name</p>
                <p className="font-semibold text-lg">{selectedVenue.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Location</p>
                <p className="font-semibold">Contact venue for address details</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarDaysIcon className="h-5 w-5 text-primary" />Event Date & Time</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date</p>
                <p className="font-semibold text-lg">{formatDateFull(selectedDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Event Type</p>
                <p className="font-semibold capitalize">{eventType.replace('_', ' ')}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UsersIcon className="h-5 w-5 text-primary" />Guest Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Number of Guests</p>
                <p className="font-semibold text-lg">{guestCount} guests</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Capacity</p>
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">✓ Within Capacity</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-2xl border-border/40 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCardIcon className="h-5 w-5 text-primary" />Payment Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-semibold">₹{finalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Method</span>
                  <Badge variant="secondary" className="text-xs">{paymentMethod === 'online' ? '💳 Online' : '💵 Cash'}</Badge>
                </div>
              </div>
              <Badge className="w-full justify-center py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">✓ {paymentMethod === 'online' ? 'Paid' : 'Pending at Venue'}</Badge>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <Button onClick={handleDownloadReceipt} variant="outline" size="lg" className="gap-2 h-12 border-2 hover:border-primary/30 hover:bg-muted/60 transition-all duration-300 font-medium rounded-xl">
              <DownloadIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Download Receipt</span>
              <span className="sm:hidden">Download</span>
            </Button>
            <Button onClick={() => handleShareBooking('email')} variant="outline" size="lg" className="gap-2 h-12 border-2 hover:border-primary/30 hover:bg-muted/60 transition-all duration-300 font-medium rounded-xl">
              <MailIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Share via Email</span>
              <span className="sm:hidden">Email</span>
            </Button>
            <Button onClick={() => handleShareBooking('whatsapp')} variant="outline" size="lg" className="gap-2 h-12 border-2 hover:border-primary/30 hover:bg-muted/60 transition-all duration-300 font-medium rounded-xl">
              <ShareIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Share on WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </Button>
          </div>

          <Link href="/">
            <Button size="lg" className="w-full h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg hover:shadow-xl transition-all duration-300 font-medium rounded-xl">
              <HomeIcon className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Alert className="border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/20">
          <MailIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            Keep your booking reference <span className="font-mono font-semibold">{bookingNumber}</span> safe. You'll need it for check-in at the venue and for any future communications.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
