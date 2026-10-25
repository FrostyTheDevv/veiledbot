import { safeText, valueArray } from '../../commandUtils.js';
export default {
  name: 'members', category: 'rooms', description: 'Show members returned by the room members endpoint.', aliases: ['memberlist'], cooldown: 8,
  async execute({ bot, client, message }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    const data = await client.getMembers(lane.roomId); const members = valueArray(data, 'members');
    const lines = members.slice(0, 20).map((member, i) => `${i + 1}. **${safeText(member.nickname || member.User?.displayName || member.User?.username || 'Member', 80)}**${member.User?.isBot ? ' · bot' : ''}`);
    const total = Number.isFinite(data?.total) ? data.total : data?.count;
    return client.sendContainer(message.laneId, { title: 'Room members', description: lines.join('\n') || 'No members were returned.', footer: `Showing ${lines.length}${Number.isFinite(total) ? ` of ${total}` : ''}. The endpoint may paginate this room’s member list.` }, { replyToId: message.id });
  },
};
