import { formatDate, safeText } from '../../commandUtils.js';

const LOCATION_TYPES = new Set(['VOICE', 'STAGE', 'EXTERNAL']);

export function parseEventInput(rawArgs, now = Date.now()) {
  const fields = String(rawArgs || '').split('|').map((field) => field.trim());
  if (fields.length < 4 || fields.length > 7) return null;
  const [laneId, name, rawType, start, description = '', externalLocation = '', timezone = 'UTC'] = fields;
  const locationType = rawType.toUpperCase();
  if (!/^[a-zA-Z0-9_-]{3,100}$/.test(laneId) || !name || name.length > 100 || !LOCATION_TYPES.has(locationType)) return null;
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(start) || !Number.isFinite(Date.parse(start))) return null;
  const startTime = Date.parse(start);
  if (startTime <= now || startTime > now + 366 * 24 * 60 * 60 * 1000) return null;
  if (description.length > 1000 || timezone.length > 64 || !timezone) return null;
  if ((locationType === 'EXTERNAL' && (!externalLocation || externalLocation.length > 500)) || (locationType !== 'EXTERNAL' && externalLocation)) return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); } catch { return null; }
  return {
    laneId,
    name,
    description: description || null,
    locationType,
    externalLocation: locationType === 'EXTERNAL' ? externalLocation : null,
    scheduledStartAt: new Date(startTime).toISOString(),
    timezone,
  };
}

export default {
  name: 'eventcreate', category: 'rooms', description: 'Create a scheduled room event.',
  usage: '<lane ID> | <name> | <VOICE|STAGE|EXTERNAL> | <start ISO timestamp> | [description] | [external location] | [timezone]', minArgs: 1, cooldown: 15,
  async execute({ bot, client, message, rawArgs }) {
    const payload = parseEventInput(rawArgs);
    if (!payload) {
      return client.sendContainer(message.laneId, {
        title: 'Check the event details',
        description: 'Use `!eventcreate lane-id | Name | VOICE | 2026-12-01T20:00:00Z | Optional description`. Start time must include a timezone and be within the next year. For EXTERNAL events, add the location before the timezone.',
      }, { replyToId: message.id });
    }
    const lane = await bot.getLaneInfo(payload.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('The event lane was not found or is not available.'), { status: 404 });
    const result = await client.createScheduledEvent(lane.roomId, payload);
    const event = result?.event || result?.data?.event || result;
    return client.sendContainer(message.laneId, {
      title: 'Event created',
      description: `**${safeText(event?.name || payload.name, 100)}** · ${formatDate(event?.scheduledStartAt || payload.scheduledStartAt)}\n${safeText(event?.id || '', 100)}`,
    }, { replyToId: message.id });
  },
};
