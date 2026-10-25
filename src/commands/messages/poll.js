import { messageId, safeText } from '../../commandUtils.js';
const voteEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
export default {
  name: 'poll', category: 'messages', description: 'Create a reaction poll with up to five choices.', usage: '<question> | <choice 1> | <choice 2> [| ...]', minArgs: 1, cooldown: 10,
  async execute({ client, message, rawArgs }) {
    const [question, ...choices] = rawArgs.split('|').map((part) => part.trim());
    if (!question || choices.length < 2 || choices.length > 5 || choices.some((choice) => !choice)) return client.sendContainer(message.laneId, { title: 'Poll format', description: 'Use `!poll question | choice one | choice two` (up to five choices).' }, { replyToId: message.id });
    const lines = choices.map((choice, index) => `${voteEmojis[index]}  ${safeText(choice, 180)}`);
    const sent = await client.sendContainer(message.laneId, { title: `📊 ${safeText(question, 160)}`, description: lines.join('\n'), footer: `Vote with a reaction · started by ${safeText(message.author.displayName || message.author.username || 'a member', 80)}` }, { replyToId: message.id });
    const id = messageId(sent); if (!id) throw new Error('Veiled did not return the poll message ID.');
    const added = [];
    for (let i = 0; i < choices.length; i++) {
      try { await client.addReaction(id, voteEmojis[i]); added.push(voteEmojis[i]); }
      catch { break; }
    }
    if (added.length !== choices.length) return client.sendContainer(message.laneId, { title: 'Poll created, voting setup incomplete', description: `The poll message is ready, but only ${added.length} of ${choices.length} vote reactions could be added. Check the bot’s reaction permissions.` }, { replyToId: id });
    return sent;
  },
};
