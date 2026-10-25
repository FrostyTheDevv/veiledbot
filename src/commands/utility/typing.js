export default {
  name: 'typing', category: 'utility', description: 'Trigger the typing indicator in this lane.', cooldown: 5,
  async execute({ client, message }) {
    await client.sendTyping(message.laneId);
    return client.sendContainer(message.laneId, { title: 'Typing indicator sent', description: 'Veiled received the typing event.' }, { replyToId: message.id });
  },
};