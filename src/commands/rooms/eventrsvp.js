import { safeText } from '../../commandUtils.js';

export default {
  name: 'eventrsvp', category: 'rooms', description: 'Add or change the bot’s RSVP for a scheduled event.', usage: '<event ID> <interested|going>', minArgs: 2, cooldown: 8,
  async execute({ client, message, args }) {
    const eventId = String(args[0] || '').trim();
    const response = String(args[1] || '').trim().toUpperCase();
    if (!/^[a-zA-Z0-9_-]{3,100}$/.test(eventId) || !['INTERESTED', 'GOING'].includes(response)) {
      return client.sendContainer(message.laneId, { title: 'Check the RSVP details', description: 'Use `!eventrsvp <event ID> interested` or `!eventrsvp <event ID> going`.' }, { replyToId: message.id });
    }
    await client.setEventRsvp(eventId, response);
    return client.sendContainer(message.laneId, { title: 'RSVP saved', description: `The bot is marked **${response.toLowerCase()}** for event **${safeText(eventId, 100)}**.` }, { replyToId: message.id });
  },
};
