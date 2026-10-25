export default {
  name: 'timestamp', category: 'utility', description: 'Show current UTC time and Unix timestamps.', aliases: ['time'], cooldown: 3,
  async execute({ client, message }) {
    const now = new Date();
    return client.sendContainer(message.laneId, { title: 'Current time', description: `UTC: **${now.toISOString()}**\nUnix seconds: **${Math.floor(now.getTime() / 1000)}**\nUnix milliseconds: **${now.getTime()}**` }, { replyToId: message.id });
  },
};
