import { valueArray } from '../../commandUtils.js';
export default {
  name: 'history', category: 'messages', description: 'Count recent messages in the current lane.', aliases: ['recent'], cooldown: 5,
  async execute({ client, message }) {
    const messages = valueArray(await client.getMessages(message.laneId), 'messages');
    return client.sendContainer(message.laneId, { title: 'Recent message history', description: `Veiled returned **${messages.length}** recent messages for this lane.`, footer: 'The API controls how much recent history is returned.' }, { replyToId: message.id });
  },
};
