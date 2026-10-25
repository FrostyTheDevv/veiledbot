export default {
  name: 'botinfo', category: 'utility', description: 'Show bot connection and runtime information.', aliases: ['about', 'info'], cooldown: 5,
  async execute({ bot, client, message }) {
    const uptime = Math.max(0, Math.floor((Date.now() - bot.startTime) / 1000));
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    const app = bot.application || {};
    return client.sendContainer(message.laneId, {
      title: app.name || 'VeiledBot',
      description: app.description || 'An open-source example bot for Veiled.',
      sections: [{ divider: true, content: `**Commands:** ${bot.commands.size}\n**Gateway:** ${bot.gateway?.connected ? 'Connected' : 'Reconnecting'}\n**Uptime:** ${days}d ${hours}h ${minutes}m ${seconds}s\n**Runtime:** Node.js ${process.versions.node}` }],
      footer: 'Built for Veiled. Source and command examples are open source.',
    }, { replyToId: message.id });
  },
};