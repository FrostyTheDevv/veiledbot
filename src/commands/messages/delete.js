import { messageId } from '../../commandUtils.js';
export default {
  name: 'delete', category: 'messages', description: 'Send a container and delete it after two seconds.', cooldown: 5,
  async execute({ client, message }) {
    const sent = await client.sendContainer(message.laneId, { title: 'Delete demo', description: 'This sample container will be deleted in two seconds.' }, { replyToId: message.id });
    const id = messageId(sent); if (!id) throw new Error('Veiled did not return the sent message ID.');
    await new Promise((resolve) => setTimeout(resolve, 2000)); await client.deleteMessage(id);
  },
};
