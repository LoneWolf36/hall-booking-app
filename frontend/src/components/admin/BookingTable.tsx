/**
 * Booking Data Table
 * 
 * Advanced table with sorting, mobile responsiveness
 * Phase5-UX-Enhancement
 */

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ChevronUpIcon, 
  ChevronDownIcon, 
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from 'lucide-react';
import type { BookingForReview } from '@/lib/api/admin';

interface BookingTableProps {
  bookings: BookingForReview[];
  onViewDetails: (bookingId: string) => void;
  onApprove?: (bookingId: string) => void;
  onReject?: (bookingId: string) => void;
}

type SortField = 'createdAt' | 'startTs' | 'totalAmountCents' | 'status';
type SortDirection = 'asc' | 'desc';

export function BookingTable({ 
  bookings, 
  onViewDetails,
  onApprove,
  onReject,
}: BookingTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedBookings = [...bookings].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    // Handle undefined values
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;
    if (aValue === bValue) return 0;
    
    const comparison = aValue > bValue ? 1 : -1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { variant: 'default' as const, icon: ClockIcon, className: 'bg-yellow-500/20 text-yellow-500' },
      confirmed: { variant: 'default' as const, icon: CheckCircleIcon, className: 'bg-green-500/20 text-green-500' },
      rejected: { variant: 'destructive' as const, icon: XCircleIcon, className: 'bg-red-500/20 text-red-500' },
    };

    const { variant, icon: Icon, className } = config[status as keyof typeof config] || config.pending;

    return (
      <Badge variant={variant} className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 inline ml-1" />
    );
  };

  return (
    <div className="rounded-lg border border-slate-700/30 bg-slate-900/20 overflow-hidden">
      {/* Mobile View */}
      <div className="md:hidden">
        {sortedBookings.map((booking) => (
          <div
            key={booking.id}
            className="p-4 border-b border-slate-700/30 last:border-0 space-y-3"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{booking.bookingNumber}</p>
                <p className="text-sm text-muted-foreground">{booking.user.name}</p>
              </div>
              {getStatusBadge(booking.status)}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Venue</p>
                <p>{booking.venue.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p>{format(new Date(booking.startTs), 'PP')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p>₹{((booking.totalAmountCents || 0) / 100).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment</p>
                <p className="capitalize">{booking.paymentMethod || 'N/A'}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewDetails(booking.id)}
                className="flex-1"
              >
                <EyeIcon className="h-4 w-4 mr-1" />
                View
              </Button>
              {booking.status === 'pending' && onApprove && (
                <Button
                  size="sm"
                  onClick={() => onApprove(booking.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-slate-700/30">
              <TableHead 
                onClick={() => handleSort('createdAt')} 
                className="cursor-pointer select-none"
              >
                Booking # <SortIcon field="createdAt" />
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead 
                onClick={() => handleSort('startTs')} 
                className="cursor-pointer select-none"
              >
                Event Date <SortIcon field="startTs" />
              </TableHead>
              <TableHead 
                onClick={() => handleSort('totalAmountCents')} 
                className="cursor-pointer select-none text-right"
              >
                Amount <SortIcon field="totalAmountCents" />
              </TableHead>
              <TableHead>Payment</TableHead>
              <TableHead 
                onClick={() => handleSort('status')} 
                className="cursor-pointer select-none"
              >
                Status <SortIcon field="status" />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBookings.map((booking) => (
              <TableRow 
                key={booking.id}
                className="border-slate-700/30 hover:bg-slate-800/20"
              >
                <TableCell className="font-medium">{booking.bookingNumber}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{booking.user.name}</p>
                    <p className="text-sm text-muted-foreground">{booking.user.phone}</p>
                  </div>
                </TableCell>
                <TableCell>{booking.venue.name}</TableCell>
                <TableCell>{format(new Date(booking.startTs), 'PP')}</TableCell>
                <TableCell className="text-right">
                  ₹{((booking.totalAmountCents || 0) / 100).toLocaleString()}
                </TableCell>
                <TableCell className="capitalize">{booking.paymentMethod || 'N/A'}</TableCell>
                <TableCell>{getStatusBadge(booking.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewDetails(booking.id)}
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                    {booking.status === 'pending' && onApprove && (
                      <Button
                        size="sm"
                        onClick={() => onApprove(booking.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {sortedBookings.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No bookings found
        </div>
      )}
    </div>
  );
}
