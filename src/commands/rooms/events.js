import { formatDate, safeText, valueArray } from '../../commandUtils.js';

export default {
  name: 'events', category: 'rooms', description: 'List upcoming scheduled events for the current room.', cooldown: 8,
  async execute({ bot, client, message }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    const result = await client.getScheduledEvents(lane.roomId, 'limit=10');
    const events = valueArray(result, 'events').slice(0, 10);
    const description = events.length
      ? events.map((event) => `• **${safeText(event.name, 100)}** · ${formatDate(event.scheduledStartAt)} · ${safeText(event.locationType || 'event', 20)} · ${event.rsvpCount ?? 0} interested`).join('\n')
      : 'There are no upcoming scheduled events visible to this bot.';
    return client.sendContainer(message.laneId, { title: 'Upcoming events', description }, { replyToId: message.id });
  },
};
