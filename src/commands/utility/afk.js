import { safeText } from '../../commandUtils.js';
export default {
  name: 'afk', category: 'utility', description: 'Set an away status; it clears when you next send a message.', usage: '[reason]', cooldown: 5,
  async execute({ bot, client, message, rawArgs }) {
    if (bot.afk.get(message.author.id)) {
      bot.afk.clear(message.author.id);
      return client.sendContainer(message.laneId, { title: 'AFK cleared', description: 'You are no longer marked as away.' }, { replyToId: message.id });
    }
    const reason = rawArgs.trim().slice(0, 300);
    bot.afk.set(message.author.id, reason);
    return client.sendContainer(message.laneId, { title: 'AFK enabled', description: reason ? `Reason: ${safeText(reason, 300)}` : 'You will be marked as away when someone mentions you.', footer: 'Your AFK status is saved locally by this bot.' }, { replyToId: message.id });
  },
};
