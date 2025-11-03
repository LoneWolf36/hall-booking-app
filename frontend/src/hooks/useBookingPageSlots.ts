import { useEffect, useMemo, useState, useCallback } from 'react';
import { useVenueTimeslots } from '@/hooks/useVenueTimeslots';
import { calculatePricingWithSlot } from '@/lib/api/pricing';
import { Badge } from '@/components/ui/badge';

// This patch shows the key wiring to replace local static slots with server-configured slots
export function useBookingPageSlots(venueId?: string, selectedDates: Date[] = [], basePrice: number = 0) {
  const { uiSlots, initialSlot } = useVenueTimeslots(venueId);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [slotPricing, setSlotPricing] = useState<any>(null);
  const activeSlots = uiSlots.length ? uiSlots : [];
  const selectedSlot = useMemo(() => activeSlots.find(s => s.id === selectedSlotId) || initialSlot, [activeSlots, selectedSlotId, initialSlot]);

  // Initialize selection when slots first load
  useEffect(() => { if (!selectedSlotId && initialSlot) setSelectedSlotId(initialSlot.id); }, [initialSlot, selectedSlotId]);

  // Compute pricing with slotId
  const recomputePricing = useCallback(async () => {
    if (!venueId || !selectedSlot || selectedDates.length === 0) return;
    const dates = [...selectedDates].sort((a,b) => a.getTime()-b.getTime()).map(d => d.toISOString().slice(0,10));
    const res = await calculatePricingWithSlot({ venueId, selectedDates: dates, slotId: selectedSlot.id });
    if ((res as any)?.data) setSlotPricing((res as any).data);
  }, [venueId, selectedSlot, selectedDates]);

  useEffect(() => { void recomputePricing(); }, [recomputePricing]);

  return { activeSlots, selectedSlot, setSelectedSlotId, slotPricing, slotSummary: slotPricing?.breakdown?.[0]?.appliedRates };
}
