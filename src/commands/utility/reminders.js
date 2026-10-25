import { safeText } from '../../commandUtils.js';
export default {
  name: 'reminders', category: 'utility', description: 'List your active reminders.', aliases: ['myreminders'], cooldown: 5,
  async execute({ bot, client, message }) {
    const list = bot.reminders.list(message.author.id);
    const lines = list.slice(0, 15).map((entry) => `• **${safeText(entry.text, 180)}** — ${entry.failed ? 'delivery failed' : `<t:${Math.floor(Date.parse(entry.dueAt) / 1000)}:R>`} · \`${entry.id}\``);
    return client.sendContainer(message.laneId, { title: `Your reminders (${list.length})`, description: lines.join('\n') || 'You have no active reminders.', footer: list.length > 15 ? 'Showing the next 15.' : undefined }, { replyToId: message.id });
  },
};
