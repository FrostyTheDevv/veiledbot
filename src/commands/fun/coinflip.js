export default { name: 'coinflip', category: 'fun', description: 'Flip a coin.', aliases: ['flip'], cooldown: 2,
  async execute({ client, message }) { const result = Math.random() < 0.5 ? 'Heads' : 'Tails'; return client.sendContainer(message.laneId, { title: 'Coin flip', description: `🪙 **${result}**` }, { replyToId: message.id }); }
};
