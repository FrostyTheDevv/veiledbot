export default {
  name: 'unpin', category: 'messages', description: 'Unpin the message you are replying to.', cooldown: 5,
  async execute({ client, message }) {
    if (!message.replyToId) return client.sendContainer(message.laneId, { title: 'Reply to a message first', description: 'Reply to the pinned message you want to remove, then run `!unpin`.' }, { replyToId: message.id });
    await client.unpinMessage(message.replyToId);
    return client.sendContainer(message.laneId, { title: 'Message unpinned', description: 'The replied-to message was removed from lane pins.' }, { replyToId: message.id });
  },
};
