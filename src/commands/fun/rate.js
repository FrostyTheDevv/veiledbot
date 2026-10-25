export default { name: 'rate', category: 'fun', description: 'Give something a random score.', usage: '<thing>', minArgs: 1, cooldown: 2,
  async execute({ client, message, rawArgs }) { const score = Math.floor(Math.random() * 101); return client.sendContainer(message.laneId, { title: 'Rating', description: `I rate **${rawArgs.slice(0, 500)}** a **${score}/100**.` }, { replyToId: message.id }); }
};
