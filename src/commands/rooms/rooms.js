import { valueArray, safeText } from '../../commandUtils.js';
export default {
  name: 'rooms', category: 'rooms', description: 'List rooms this bot has joined.', aliases: ['servers'], cooldown: 5,
  async execute({ client, message }) {
    const data = await client.getMyRooms(); const rooms = valueArray(data, 'rooms');
    const lines = rooms.slice(0, 25).map((room, i) => `${i + 1}. **${safeText(room.name || room.title || 'Room', 80)}** · \`${safeText(room.id, 80)}\``).join('\n');
    return client.sendContainer(message.laneId, { title: `Bot rooms (${rooms.length})`, description: lines || 'This bot has not joined any rooms yet.', footer: rooms.length > 25 ? 'Showing the first 25 rooms.' : undefined }, { replyToId: message.id });
  },
};
