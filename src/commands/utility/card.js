import { safeText } from '../../commandUtils.js';
export default {
  name: 'card', category: 'utility', description: 'Build a Components V2 container card.', aliases: ['container'], usage: '<title> | <text>', minArgs: 1, cooldown: 5,
  async execute({ client, message, rawArgs }) {
    const [title, ...parts] = rawArgs.split('|');
    return client.sendContainer(message.laneId, { title: safeText(title.trim().slice(0, 100)) || 'Your card', description: safeText(parts.join('|').trim().slice(0, 3500)) || 'Add text after a `|` to fill the card.' }, { replyToId: message.id });
  },
};
