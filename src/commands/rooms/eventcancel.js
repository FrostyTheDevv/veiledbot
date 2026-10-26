import { safeText } from '../../commandUtils.js';

export default {
  name: 'eventcancel', category: 'rooms', description: 'Cancel one scheduled event or its future recurring series.',
  usage: '<event ID> [occurrence|series]', minArgs: 1, cooldown: 10,
  async execute({ client, message, args }) {
    const eventId = String(args[0] || '').trim();
    const scope = String(args[1] || 'occurrence').toUpperCase();
    if (!/^[a-zA-Z0-9_-]{3,100}$/.test(eventId) || !['OCCURRENCE', 'SERIES'].includes(scope)) {
      return client.sendContainer(message.laneId, { title: 'Event cancel format', description: 'Use `!eventcancel <event ID> [occurrence|series]`. Series cancellation affects upcoming events in the recurring series. The bot must own the event or have Manage Events.' }, { replyToId: message.id });
    }
    const result = await client.cancelScheduledEvent(eventId, scope);
    return client.sendContainer(message.laneId, { title: 'Event cancelled', description: `Cancelled **${safeText(eventId, 100)}** · ${result?.cancelledOccurrenceCount ?? 1} occurrence(s).` }, { replyToId: message.id });
  },
};
