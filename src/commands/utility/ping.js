export default {
  name: 'ping', category: 'utility', description: 'Check Veiled API and gateway response time.', aliases: ['p', 'latency'], cooldown: 2,
  async execute({ bot, client, message }) {
    const startedAt = Date.now();
    const health = await client.getMe();
    const apiMs = Date.now() - startedAt;
    return client.sendContainer(message.laneId, { title: 'Pong!', description: `API round trip: **${apiMs} ms**\nGateway: **${bot.gateway?.connected ? 'connected' : 'reconnecting'}**`, footer: health?.user?.username ? `Signed in as ${health.user.username}` : 'VeiledBot' }, { replyToId: message.id });
  },
};