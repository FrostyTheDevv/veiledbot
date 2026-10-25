import { safeText } from '../../commandUtils.js';
const answers = ['Yes.', 'No.', 'Probably.', 'Probably not.', 'Ask again later.', 'The outlook is good.', 'The outlook is unclear.', 'I would not count on it.'];
export default { name: '8ball', category: 'fun', description: 'Get a playful answer to a yes-or-no question.', usage: '<question>', minArgs: 1, cooldown: 3,
  async execute({ client, message, rawArgs }) { const answer = answers[Math.floor(Math.random() * answers.length)]; return client.sendContainer(message.laneId, { title: '🎱 Ask the magic 8-ball', description: `**${safeText(rawArgs, 500)}**\n\n${answer}` }, { replyToId: message.id }); }
};
