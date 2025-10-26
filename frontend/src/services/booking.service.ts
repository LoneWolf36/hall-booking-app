import { api } from '@/lib/api';
import { CreateBookingDto, Booking, BookingStatus } from '@/types/booking';

export class BookingService {
  static async getAllBookings() {
    const response = await api.getBookings();
    return response.data;
  }

  static async getBookingById(id: string): Promise<Booking> {
    const response = await api.getBooking(id);
    return response.data;
  }

  static async createBooking(bookingData: CreateBookingDto): Promise<Booking> {
    const response = await api.createBooking(bookingData);
    return response.data;
  }

  static async updateBooking(id: string, updateData: Partial<Booking>): Promise<Booking> {
    const response = await api.updateBooking(id, updateData);
    return response.data;
  }

  static async checkAvailability(venueId: string, startTime: string, endTime: string) {
    // This would call a specific availability endpoint
    // For now, we'll use a placeholder implementation
    try {
      // Implementation would check against existing bookings
      return { available: true, conflicts: [] };
    } catch (error) {
      throw new Error('Failed to check availability');
    }
  }

  static getBookingStatusText(status: BookingStatus): string {
    const statusMap = {
      [BookingStatus.PENDING]: 'Pending Confirmation',
      [BookingStatus.CONFIRMED]: 'Confirmed',
      [BookingStatus.CANCELLED]: 'Cancelled',
      [BookingStatus.COMPLETED]: 'Completed',
    };
    return statusMap[status] || 'Unknown';
  }

  static getBookingStatusColor(status: BookingStatus): string {
    const colorMap = {
      [BookingStatus.PENDING]: 'text-yellow-600',
      [BookingStatus.CONFIRMED]: 'text-green-600',
      [BookingStatus.CANCELLED]: 'text-red-600',
      [BookingStatus.COMPLETED]: 'text-blue-600',
    };
    return colorMap[status] || 'text-gray-600';
  }
}
