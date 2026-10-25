import { safeText } from '../../commandUtils.js';
export default {
  name: 'laneinfo', category: 'rooms', description: 'Show details for the current lane.', aliases: ['channelinfo'], cooldown: 3,
  async execute({ bot, client, message }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane) throw Object.assign(new Error('Could not fetch this lane.'), { status: 404 });
    const data = await client.getLane(message.laneId); const item = data?.lane || data?.data || data;
    return client.sendContainer(message.laneId, { title: `#${safeText(item.name || lane.name || 'Lane', 100)}`, description: safeText(item.topic || lane.topic || 'No lane topic is set.', 1000), sections: [{ divider: true, content: `**Lane ID**\n\`${safeText(item.id || lane.id, 80)}\`\n\n**Room**\n${safeText(lane.roomName, 100)}\n\n**Type**\n${safeText(item.type || lane.type || 'Unknown', 40)}` }] }, { replyToId: message.id });
  },
};
