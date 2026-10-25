export default {
  name: 'react', category: 'messages', description: 'Add an emoji reaction to your command message.', usage: '[emoji]', cooldown: 2,
  async execute({ client, message, args }) {
    const emoji = args[0] || '👍'; await client.addReaction(message.id, emoji);
    return client.sendContainer(message.laneId, { title: 'Reaction added', description: `Added ${emoji} to your command message.` }, { replyToId: message.id });
  },
};
