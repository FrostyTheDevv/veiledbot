import { messageId, safeText } from '../../commandUtils.js';
import { createContainer } from '../../containers.js';
export default {
  name: 'edit', category: 'messages', description: 'Send a sample container and edit it.', usage: '[replacement text]', cooldown: 5,
  async execute({ client, message, rawArgs }) {
    const sent = await client.sendContainer(message.laneId, { title: 'Container edit demo', description: 'This Components V2 message will update shortly.' }, { replyToId: message.id });
    const id = messageId(sent); if (!id) throw new Error('Veiled did not return the sent message ID.');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return client.editMessage(id, { components: createContainer({ title: 'Container updated', description: safeText(rawArgs.trim().slice(0, 3500)) || 'This container was edited using the bot API.' }) });
  },
};
