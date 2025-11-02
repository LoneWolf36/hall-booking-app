# Intelligent Timeslot System Implementation

This document describes the comprehensive end-to-end timeslot system implemented for the Hall Booking Application.

## 🎯 Overview

The timeslot system provides flexible booking options that intelligently adapt to each venue's capabilities. Some venues support partial-day bookings (morning, afternoon, evening) while others operate on full-day bookings only.

### Key Features

- **Intelligent Venue Detection**: Automatically detects which venues support timeslots
- **Flexible Pricing**: Different pricing multipliers for different time slots
- **Backend Integration**: Seamless conversion to `startTs`/`endTs` timestamps
- **Multi-day Support**: Handles single-day, consecutive multi-day, and separate multi-day bookings
- **Visual Indicators**: Clear UI showing venue timeslot capabilities

## 🔧 Architecture

### Frontend Components

#### 1. TimeSlotSelector Component
- **Location**: `frontend/src/components/booking/TimeSlotSelector.tsx`
- **Features**:
  - Intelligent venue capability detection
  - Visual indicators for venue support
  - Dynamic slot filtering based on venue
  - Pricing calculations with multipliers

#### 2. BookingPage Integration
- **Location**: `frontend/src/app/booking/page.tsx`
- **Features**:
  - Passes venue data to TimeSlotSelector
  - Handles timeslot state management
  - Converts timeslots to timestamps for backend

#### 3. Booking Utilities
- **Location**: `frontend/src/lib/booking-utils.ts`
- **Features**:
  - Smart booking creation logic
  - Timeslot to timestamp conversion
  - Multi-day booking handling
  - Validation and error handling

### Backend Integration

#### 1. Venue Configuration
- Venues store timeslot settings in `venue.settings.timeslotSupport`
- Configuration includes:
  ```json
  {
    "timeslotSupport": {
      "enabled": true,
      "allowedSlots": ["morning", "afternoon", "evening", "full_day"],
      "defaultSlot": "evening",
      "description": "Venue description"
    }
  }
  ```

#### 2. Configuration Script
- **Location**: `backend/scripts/configure-venue-timeslots.js`
- **Usage**: `node scripts/configure-venue-timeslots.js`
- Automatically configures venues based on:
  - Venue capacity (≥200 = timeslot support)
  - Existing flexible pricing
  - Manual overrides

## 🕰️ Available Time Slots

| Slot ID | Label | Time Range | Duration | Price Multiplier | Description |
|---------|-------|------------|----------|------------------|-------------|
| `morning` | Morning | 06:00-12:00 | 6h | 0.6x (40% savings) | Perfect for breakfast events, meetings |
| `afternoon` | Afternoon | 12:00-18:00 | 6h | 0.8x (20% savings) | Great for lunch events, conferences |
| `evening` | Evening | 18:00-00:00 | 6h | 1.0x (standard) | Ideal for dinner, parties, celebrations |
| `full_day` | Full Day | 00:00-23:59 | 24h | 1.5x (50% premium) | Complete access for large events |

## 📝 Implementation Guide

### Setting Up Timeslot Support

1. **Configure Backend Venues**:
   ```bash
   cd backend
   node scripts/configure-venue-timeslots.js
   ```

2. **Frontend Integration** (already implemented):
   ```tsx
   import { TimeSlotSelector, getDefaultTimeSlot } from '@/components/booking/TimeSlotSelector';
   
   <TimeSlotSelector
     value={selectedTimeSlot.id}
     onChange={handleTimeSlotChange}
     basePrice={basePrice}
     venue={currentVenue} // Pass venue data for intelligent detection
   />
   ```

3. **Creating Bookings**:
   ```tsx
   import { createTimeslotBooking } from '@/lib/booking-utils';
   
   const result = await createTimeslotBooking({
     venueId: venue.id,
     selectedDates: [date1, date2],
     timeSlot: selectedTimeSlot,
     eventType: 'wedding',
     guestCount: 150,
     // ... other booking data
   });
   ```

### Venue Configuration Examples

#### Enable Timeslots for Large Venues
```javascript
// In configure-venue-timeslots.js
const VENUE_OVERRIDES = {
  'Premium Banquet Hall': {
    timeslotSupport: {
      enabled: true,
      allowedSlots: ['afternoon', 'evening', 'full_day'],
      defaultSlot: 'evening',
      description: 'Premium venue with flexible timing'
    }
  }
};
```

#### Force Full-Day Only
```javascript
const VENUE_OVERRIDES = {
  'Traditional Hall': {
    timeslotSupport: {
      enabled: false,
      allowedSlots: ['full_day'],
      defaultSlot: 'full_day',
      description: 'Classic full-day venue experience'
    }
  }
};
```

## 🔄 Booking Flow

### Single Day Booking
1. User selects one date and time slot
2. Frontend converts to `startTs` and `endTs`
3. Single booking created in backend

### Multi-Day Consecutive (Full Day)
1. User selects consecutive dates with full-day slot
2. Frontend creates single booking spanning all dates
3. `startTs` = first date start, `endTs` = last date end

### Multi-Day Separate
1. User selects non-consecutive dates OR partial-day slots
2. Frontend creates multiple individual bookings
3. Each date gets its own booking with proper timestamps

## 🎯 Business Logic

### Venue Intelligence
The system automatically determines venue capabilities:

```typescript
function getVenueTimeslotCapability(venue) {
  // 1. Check explicit configuration
  if (venue.settings?.timeslotSupport) {
    return venue.settings.timeslotSupport;
  }
  
  // 2. Intelligent detection
  const capacity = venue.capacity || 0;
  const isLargeVenue = capacity > 200;
  const hasFlexiblePricing = venue.settings?.pricing?.weekendMultiplier;
  
  const supportsTimeslots = isLargeVenue || hasFlexiblePricing;
  
  return {
    supportsTimeslots,
    allowedSlots: supportsTimeslots ? ['morning', 'afternoon', 'evening', 'full_day'] : ['full_day'],
    defaultSlot: supportsTimeslots ? 'evening' : 'full_day'
  };
}
```

### Pricing Calculation
```typescript
const basePrice = venue.basePriceCents / 100;
const adjustedPrice = basePrice * timeSlot.priceMultiplier;
const totalPrice = selectedDates.length * adjustedPrice;
```

## 📦 API Integration

### Frontend to Backend Data Flow

1. **User Selection**:
   - Dates: `[Date, Date, ...]`
   - Time Slot: `{ id: 'evening', startTime: '18:00', endTime: '00:00', ... }`

2. **Conversion to Backend Format**:
   ```typescript
   const { startTs, endTs } = timeSlotToTimestamps(date, timeSlot);
   // startTs: 2024-03-15T18:00:00.000Z
   // endTs: 2024-03-16T00:00:00.000Z (next day for midnight end)
   ```

3. **Backend Booking Creation**:
   ```typescript
   const booking = await createBooking({
     venueId,
     startTs, // ISO timestamp
     endTs,   // ISO timestamp
     selectedDates: [date],
     // ... other data
   });
   ```

## 🔍 Testing

### Manual Testing Steps

1. **Setup**:
   ```bash
   # Configure venues
   cd backend && node scripts/configure-venue-timeslots.js
   
   # Start services
   npm run dev # in both frontend and backend
   ```

2. **Test Scenarios**:
   - **Large Venue**: Should show all timeslot options
   - **Small Venue**: Should show "Full Day" only with explanation
   - **Multi-day Selection**: Test consecutive vs non-consecutive dates
   - **Pricing**: Verify different multipliers are applied

3. **Expected Behaviors**:
   - UI adapts to venue capabilities
   - Proper timestamps logged in console
   - Backend receives correct `startTs`/`endTs`
   - Multi-day bookings handled appropriately

## 🌐 Browser Console Debugging

The system provides detailed logging:

```
Booking timestamps: {
  dates: [
    {
      date: "2024-03-15",
      startTs: "2024-03-15T18:00:00.000Z",
      endTs: "2024-03-16T00:00:00.000Z",
      timeSlot: "Evening"
    }
  ]
}
```

## 📊 Benefits

### For Venue Owners
- **Flexibility**: Can choose full-day or partial-day operations
- **Revenue Optimization**: Different pricing for different time slots
- **Customer Satisfaction**: More booking options

### For Customers
- **Cost Savings**: Up to 40% savings with morning slots
- **Flexibility**: Choose duration that fits their event
- **Transparency**: Clear pricing and time information

### For Developers
- **Intelligent Adaptation**: System works with any venue configuration
- **Backend Compatibility**: Seamless integration with existing API
- **Maintainable**: Clean separation of concerns

## 🚀 Future Enhancements

1. **Dynamic Pricing**: Time-based surge pricing
2. **Custom Time Slots**: Venue-specific time ranges
3. **Seasonal Adjustments**: Different slots for different seasons
4. **Analytics**: Track popular time slots and optimize pricing
5. **Integration**: Calendar sync and external booking platforms

## 📞 Support

For questions or issues with the timeslot system:

1. Check browser console for debugging information
2. Verify venue configuration with the backend script
3. Ensure proper venue data is passed to components
4. Test with different venue types (large/small, configured/unconfigured)

This implementation provides a robust, scalable foundation for timeslot-based bookings while maintaining full backward compatibility with existing full-day booking systems.