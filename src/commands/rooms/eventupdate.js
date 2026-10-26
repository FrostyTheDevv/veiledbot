import { safeText } from '../../commandUtils.js';

export function parseEventUpdate(rawArgs) {
  const [eventId, name, start, timezone = 'UTC'] = String(rawArgs || '').split('|').map((value) => value.trim());
  if (!/^[a-zA-Z0-9_-]{3,100}$/.test(eventId || '') || !name || name.length > 100 || !/[zZ]|[+-]\d{2}:\d{2}$/.test(start || '') || !Number.isFinite(Date.parse(start || ''))) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); } catch { return null; }
  return { eventId, payload: { name, scheduledStartAt: new Date(start).toISOString(), timezone } };
}

export default {
  name: 'eventupdate', category: 'rooms', description: 'Rename or reschedule an upcoming room event.',
  usage: '<event ID> | <new name> | <start ISO timestamp> | [timezone]', minArgs: 1, cooldown: 10,
  async execute({ client, message, rawArgs }) {
    const parsed = parseEventUpdate(rawArgs);
    if (!parsed) return client.sendContainer(message.laneId, { title: 'Event update format', description: 'Use `!eventupdate event-id | New name | 2026-12-01T20:00:00Z | America/New_York`. Start time must include a timezone and be in the future. The bot must own the event or have Manage Events.' }, { replyToId: message.id });
    const result = await client.updateScheduledEvent(parsed.eventId, parsed.payload);
    const event = result?.event || result;
    return client.sendContainer(message.laneId, { title: 'Event updated', description: `Updated **${safeText(event?.name || parsed.payload.name, 100)}** (${safeText(parsed.eventId, 100)}).` }, { replyToId: message.id });
  },
};
