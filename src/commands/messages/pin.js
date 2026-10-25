import { messageId } from '../../commandUtils.js';
export default {
  name: 'pin', category: 'messages', description: 'Pin the message you are replying to.', cooldown: 5,
  async execute({ client, message }) {
    if (!message.replyToId) return client.sendContainer(message.laneId, { title: 'Reply to a message first', description: 'Reply to the message you want to pin, then run `!pin`.' }, { replyToId: message.id });
    await client.pinMessage(message.replyToId);
    return client.sendContainer(message.laneId, { title: 'Message pinned', description: `Pinned message \`${messageId({ id: message.replyToId })}\`.` }, { replyToId: message.id });
  },
};
