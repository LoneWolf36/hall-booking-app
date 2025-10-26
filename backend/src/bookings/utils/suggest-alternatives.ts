import { AvailabilityResponseDto } from '../dto/booking-response.dto';
import { addMinutes } from './date.util';

export function suggestAlternatives(
  requestedStart: Date,
  requestedEnd: Date,
  conflicts: { startTs: Date; endTs: Date }[],
  limit = 3,
): { startTs: Date; endTs: Date; isFullDay: boolean }[] {
  const durationMs = requestedEnd.getTime() - requestedStart.getTime();
  const suggestions: { startTs: Date; endTs: Date; isFullDay: boolean }[] = [];

  // Sort conflicts by start time
  const sorted = [...conflicts].sort((a, b) => a.startTs.getTime() - b.startTs.getTime());

  // 1) Next available after last conflict that overlaps
  const overlapping = sorted.filter(
    (c) => c.startTs < requestedEnd && c.endTs > requestedStart,
  );
  let anchor = requestedStart;
  if (overlapping.length > 0) {
    const last = overlapping[overlapping.length - 1];
    anchor = new Date(Math.max(requestedEnd.getTime(), last.endTs.getTime()))
  }
  if (suggestions.length < limit) {
    const s = { startTs: anchor, endTs: new Date(anchor.getTime() + durationMs), isFullDay: false };
    suggestions.push(s);
  }

  // 2) Slightly earlier window before first conflict (if any)
  if (overlapping.length > 0) {
    const first = overlapping[0];
    const potentialEnd = new Date(first.startTs.getTime() - 15 * 60 * 1000); // 15 min buffer
    const potentialStart = new Date(potentialEnd.getTime() - durationMs);
    if (potentialStart > new Date()) {
      suggestions.push({ startTs: potentialStart, endTs: potentialEnd, isFullDay: false });
    }
  }

  // 3) Same day, shift by +1 hour increments (up to 2 more)
  let next = new Date(anchor.getTime());
  for (let i = 0; i < 2 && suggestions.length < limit; i++) {
    next = addMinutes(next, 60);
    suggestions.push({ startTs: next, endTs: new Date(next.getTime() + durationMs), isFullDay: false });
  }

  return suggestions.slice(0, limit);
}
