import { safeText } from '../../commandUtils.js';
export default {
  name: 'roominfo', category: 'rooms', description: 'Show details for the current room.', aliases: ['serverinfo'], cooldown: 5,
  async execute({ bot, client, message }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    const data = await client.getRoom(lane.roomId); const room = data?.room || data?.data || data;
    const owner = room.owner?.username || room.owner?.displayName || room.ownerId || 'Unknown';
    const created = room.createdAt ? new Date(room.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'Unknown';
    return client.sendContainer(message.laneId, { title: safeText(room.name || lane.roomName, 100), description: safeText(room.description || 'No room description is set.', 1000), sections: [{ divider: true, content: `**Room ID**\n\`${safeText(room.id || lane.roomId, 80)}\`\n\n**Owner**\n${safeText(owner, 100)}\n\n**Created**\n${created}\n\n**Verification**\n${safeText(room.verificationLevel || 'Not provided by API', 50)}` }] }, { replyToId: message.id });
  },
};
