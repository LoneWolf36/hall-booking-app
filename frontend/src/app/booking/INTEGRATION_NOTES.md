import { getVenueTimeslots } from '@/lib/api/timeslots';
import { calculatePricingWithSlot } from '@/lib/api/pricing';

// Example integration notes:
// 1) Use useVenueTimeslots(venueInfo?.id) to get uiSlots & initialSlot
// 2) Pass uiSlots into <TimeSlotSelector> instead of defaults (or merge for fallback)
// 3) When pricing, call calculatePricingWithSlot({ venueId, selectedDates: [...], slotId: selectedTimeSlot.id })
// 4) For availability, call GET /bookings/venue/:id/availability/slots?date=YYYY-MM-DD to disable sold-out sessions per date
