import { safeText } from '../../commandUtils.js';
export default {
  name: 'echo', category: 'utility', description: 'Repeat text in a Components V2 container without triggering mentions.', usage: '<text>', minArgs: 1, cooldown: 2,
  async execute({ client, message, rawArgs }) {
    return client.sendContainer(message.laneId, { title: 'Echo', description: safeText(rawArgs.slice(0, 3500)) }, { replyToId: message.id });
  },
};
