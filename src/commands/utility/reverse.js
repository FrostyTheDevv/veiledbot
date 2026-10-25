import { safeText } from '../../commandUtils.js';
export default {
  name: 'reverse', category: 'utility', description: 'Reverse a line of text.', usage: '<text>', minArgs: 1, cooldown: 2,
  async execute({ client, message, rawArgs }) { return client.sendContainer(message.laneId, { title: 'Reversed text', description: safeText(Array.from(rawArgs).reverse().join('').slice(0, 3500)) }, { replyToId: message.id }); },
};
