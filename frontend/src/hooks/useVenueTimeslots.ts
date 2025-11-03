import { useEffect, useMemo, useState } from 'react';
import { TimeSlotSelector, type TimeSlot, getDefaultTimeSlot } from '@/components/booking/TimeSlotSelector';
import { getVenueTimeslots, type VenueTimeslotsDto } from '@/lib/api/timeslots';

export function useVenueTimeslots(venueId?: string) {
  const [serverConfig, setServerConfig] = useState<VenueTimeslotsDto | null>(null);
  useEffect(() => { if (!venueId) return; (async () => { const res = await getVenueTimeslots(venueId); if (res?.data) setServerConfig(res.data); })(); }, [venueId]);

  const uiSlots: TimeSlot[] = useMemo(() => {
    if (!serverConfig) return [] as TimeSlot[];
    return serverConfig.sessions.filter(s => s.active !== false).map(s => ({
      id: s.id,
      label: s.label,
      startTime: s.start,
      endTime: s.end,
      duration: 0,
      priceMultiplier: s.priceMultiplier ?? 1,
      description: 'Venue defined session',
      icon: serverConfig.mode === 'full_day' ? (require('lucide-react').CalendarIcon) : (require('lucide-react').ClockIcon)
    })) as TimeSlot[];
  }, [serverConfig]);

  const initialSlot = uiSlots.length ? uiSlots[0] : getDefaultTimeSlot();
  return { serverConfig, uiSlots, initialSlot };
}
