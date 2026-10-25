export default {
  name: 'remindcancel', category: 'utility', description: 'Cancel one of your reminders by its ID.', aliases: ['cancelreminder'], usage: '<reminder ID>', minArgs: 1, cooldown: 3,
  async execute({ bot, client, message, args }) {
    const removed = bot.reminders.cancel(message.author.id, args[0]);
    return client.sendContainer(message.laneId, removed ? { title: 'Reminder cancelled', description: `Reminder \`${args[0]}\` was removed.` } : { title: 'Reminder not found', description: 'Check `!reminders` for your active reminder IDs.' }, { replyToId: message.id });
  },
};
