export function toIST(date: Date): string {
  const tzOffset = 5.5 * 60; // minutes
  const ist = new Date(date.getTime() + tzOffset * 60 * 1000);
  // Return human-friendly ISO with +05:30 suffix
  return ist.toISOString().replace('Z', '+05:30');
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
