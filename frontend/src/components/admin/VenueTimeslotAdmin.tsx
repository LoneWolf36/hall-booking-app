import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getVenueTimeslots, updateVenueTimeslots, VenueTimeslotsDto } from '@/lib/api/timeslots';

export function VenueTimeslotAdmin({ venueId, token }: { venueId: string; token?: string }) {
  const [config, setConfig] = useState<VenueTimeslotsDto>({ mode: 'full_day', sessions: [{ id: 'full_day', label: 'Full Day', start: '00:00', end: '23:59', priceMultiplier: 1, active: true }] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getVenueTimeslots(venueId);
      if (res?.data) setConfig(res.data);
      setLoading(false);
    })();
  }, [venueId]);

  const addSession = () => setConfig(prev => ({ ...prev, mode: 'fixed_sessions', sessions: [...prev.sessions, { id: `custom_${Date.now()}`, label: 'New Session', start: '09:00', end: '12:00', priceMultiplier: 1, active: true }] }));
  const save = async () => { await updateVenueTimeslots(venueId, config, token); };

  if (loading) return <div>Loading timeslots…</div>;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Hall Timings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge>{config.mode}</Badge>
          <Button variant="outline" size="sm" onClick={() => setConfig({ mode: 'full_day', sessions: [{ id: 'full_day', label: 'Full Day', start: '00:00', end: '23:59', priceMultiplier: 1, active: true }] })}>Full Day</Button>
          <Button variant="outline" size="sm" onClick={() => setConfig(prev => ({ ...prev, mode: 'fixed_sessions' }))}>Fixed Sessions</Button>
          <Button variant="outline" size="sm" onClick={addSession}>Add Session</Button>
        </div>
        {config.sessions.map((s, i) => (
          <div key={s.id} className="grid grid-cols-5 gap-2 items-end">
            <div>
              <Label>Label</Label>
              <Input value={s.label} onChange={e => setConfig(prev => { const sessions = [...prev.sessions]; sessions[i] = { ...s, label: e.target.value }; return { ...prev, sessions }; })} />
            </div>
            <div>
              <Label>Start</Label>
              <Input value={s.start} onChange={e => setConfig(prev => { const sessions = [...prev.sessions]; sessions[i] = { ...s, start: e.target.value }; return { ...prev, sessions }; })} />
            </div>
            <div>
              <Label>End</Label>
              <Input value={s.end} onChange={e => setConfig(prev => { const sessions = [...prev.sessions]; sessions[i] = { ...s, end: e.target.value }; return { ...prev, sessions }; })} />
            </div>
            <div>
              <Label>Multiplier</Label>
              <Input type="number" step="0.1" value={s.priceMultiplier ?? 1} onChange={e => setConfig(prev => { const sessions = [...prev.sessions]; sessions[i] = { ...s, priceMultiplier: parseFloat(e.target.value) }; return { ...prev, sessions }; })} />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfig(prev => { const sessions = [...prev.sessions]; sessions[i] = { ...s, active: !s.active }; return { ...prev, sessions }; })}>{s.active ? 'Active' : 'Inactive'}</Button>
              <Button variant="destructive" onClick={() => setConfig(prev => ({ ...prev, sessions: prev.sessions.filter((_, idx) => idx !== i) }))}>Remove</Button>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={save}>Save Timings</Button>
        </div>
      </CardContent>
    </Card>
  );
}
