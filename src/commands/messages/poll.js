import { safeText } from '../../commandUtils.js';
export default {
  name: 'poll', category: 'messages', description: 'Create a Veiled poll with up to ten choices.', usage: '<question> | <choice 1> | <choice 2> [| ...]', minArgs: 1, cooldown: 10,
  async execute({ client, message, rawArgs }) {
    const [question, ...choices] = rawArgs.split('|').map((part) => part.trim());
    if (!question || question.length > 150 || choices.length < 2 || choices.length > 10 || choices.some((choice) => !choice || choice.length > 80)) {
      return client.sendContainer(message.laneId, { title: 'Poll format', description: `Use !poll question | choice one | choice two with 2–10 choices. Questions allow 150 characters; choices allow 80. The bot needs Create Polls permission. Example: ${safeText(rawArgs, 240)}` }, { replyToId: message.id });
    }
    return client.createPoll(message.laneId, { question, options: choices, durationHours: 24, allowMultiselect: false, replyToId: message.id });
  },
};
