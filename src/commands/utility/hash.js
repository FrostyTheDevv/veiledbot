import { createHash } from 'node:crypto';
export default {
  name: 'hash', category: 'utility', description: 'Create a SHA-256 hash of text.', usage: '<text>', minArgs: 1, cooldown: 3,
  async execute({ client, message, rawArgs }) {
    const digest = createHash('sha256').update(rawArgs, 'utf8').digest('hex');
    return client.sendContainer(message.laneId, { title: 'SHA-256', description: `\`${digest}\`` }, { replyToId: message.id });
  },
};
