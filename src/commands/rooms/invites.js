import { safeText, valueArray } from '../../commandUtils.js';

export default {
  name: 'invites', category: 'rooms', description: 'List active invites for the current room.', cooldown: 8,
  async execute({ bot, client, message }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    const result = await client.getRoomInvites(lane.roomId);
    const invites = valueArray(result, 'invites').filter((invite) => invite?.code).slice(0, 12);
    const description = invites.length
      ? invites.map((invite) => {
        const expires = invite.expiresAt ? ` · expires ${safeText(new Date(invite.expiresAt).toLocaleString(), 80)}` : '';
        return `• [${safeText(invite.code, 80)}](https://veiled.lol/invite/${encodeURIComponent(invite.code)})${expires}`;
      }).join('\n')
      : 'There are no active invites visible to this bot.';
    return client.sendContainer(message.laneId, { title: 'Room invites', description }, { replyToId: message.id });
  },
};
