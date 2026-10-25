export default {
  name: 'roll', category: 'fun', description: 'Roll dice using NdS notation (for example, 2d20+3).', aliases: ['dice'], usage: '[NdS[+/-modifier]]', cooldown: 2,
  async execute({ client, message, args }) {
    const notation = (args[0] || '1d20').toLowerCase();
    const match = notation.match(/^(\d{1,2})d(\d{1,5})([+-]\d{1,6})?$/);
    if (!match) return client.sendContainer(message.laneId, { title: 'Invalid dice', description: 'Use notation such as `1d20`, `2d6+3`, or `4d8-1`.' }, { replyToId: message.id });
    const count = Number(match[1]), sides = Number(match[2]), modifier = Number(match[3] || 0);
    if (count < 1 || count > 20 || sides < 2 || sides > 100000) return client.sendContainer(message.laneId, { title: 'Dice limits', description: 'Roll 1–20 dice with 2–100,000 sides each.' }, { replyToId: message.id });
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    return client.sendContainer(message.laneId, { title: `🎲 ${notation}`, description: `Rolls: ${rolls.join(', ')}${modifier ? `\nModifier: ${modifier > 0 ? '+' : ''}${modifier}` : ''}\n**Total: ${rolls.reduce((a, b) => a + b, modifier)}**` }, { replyToId: message.id });
  },
};
