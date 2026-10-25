import { safeText } from '../../commandUtils.js';
export default {
  name: 'choose', category: 'fun', description: 'Choose randomly from options separated by |.', usage: '<option 1> | <option 2> | ...', minArgs: 1, cooldown: 2,
  async execute({ client, message, rawArgs }) {
    const options = rawArgs.split('|').map((item) => item.trim()).filter(Boolean);
    if (options.length < 2 || options.length > 20) return client.sendContainer(message.laneId, { title: 'Add more options', description: 'Separate 2–20 choices with `|`.' }, { replyToId: message.id });
    const choice = options[Math.floor(Math.random() * options.length)];
    return client.sendContainer(message.laneId, { title: 'I choose…', description: `**${safeText(choice, 1000)}**`, footer: `Picked 1 of ${options.length} options.` }, { replyToId: message.id });
  },
};
