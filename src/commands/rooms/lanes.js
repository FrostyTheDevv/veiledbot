import { safeText, valueArray } from '../../commandUtils.js';
export default {
  name: 'lanes', category: 'rooms', description: 'List lanes in the current room.', aliases: ['channels'], cooldown: 5,
  async execute({ bot, client, message }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    const data = await client.getLanes(lane.roomId); const lanes = valueArray(data, 'lanes');
    const lines = lanes.slice(0, 35).map((item) => `• **${safeText(item.name || item.title || 'Lane', 80)}** · ${safeText(item.type || 'lane', 24)} · \`${safeText(item.id, 60)}\``).join('\n');
    return client.sendContainer(message.laneId, { title: `Lanes in ${safeText(lane.roomName, 80)}`, description: lines || 'No lanes were returned.', footer: lanes.length > 35 ? 'Showing the first 35 lanes.' : undefined }, { replyToId: message.id });
  },
};
