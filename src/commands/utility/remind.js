import { parseDuration } from '../../state.js';
import { safeText } from '../../commandUtils.js';
export default {
  name: 'remind', category: 'utility', description: 'Schedule a reminder in this lane (survives bot restarts).', usage: '<duration> <reminder text>', minArgs: 2, cooldown: 5,
  async execute({ bot, client, message, args, rawArgs }) {
    const seconds = parseDuration(args[0]);
    if (!seconds) return client.sendContainer(message.laneId, { title: 'Invalid reminder time', description: 'Use a duration such as `15m`, `2h`, `1d`, or `1w2d`. Maximum is 30 days.' }, { replyToId: message.id });
    const text = rawArgs.slice(args[0].length).trim().slice(0, 500);
    if (!text) return client.sendContainer(message.laneId, { title: 'Add reminder text', description: 'Example: `!remind 30m take a break`.' }, { replyToId: message.id });
    const reminder = bot.reminders.create({ userId: message.author.id, laneId: message.laneId, text, dueAt: Date.now() + seconds * 1000 });
    return client.sendContainer(message.laneId, { title: 'Reminder scheduled', description: `**${safeText(text, 500)}**\nDue <t:${Math.floor(Date.parse(reminder.dueAt) / 1000)}:R>.`, footer: `ID: ${reminder.id} · cancel with !remindcancel ${reminder.id}` }, { replyToId: message.id });
  },
};
