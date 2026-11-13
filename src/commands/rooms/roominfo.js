import { resolveMediaUrl, safeText } from '../../commandUtils.js';

export default {
  name: 'roominfo',
  category: 'rooms',
  description: 'Show details, icon, and banner for the current room.',
  aliases: ['ri', 'serverinfo'],
  cooldown: 5,
  async execute({ bot, client, message }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    const data = await client.getRoom(lane.roomId);
    const room = data?.room || data?.data || data || {};
    const roomName = safeText(room.name || lane.roomName || 'Room', 100);
    const owner = room.owner?.username || room.owner?.displayName || room.ownerId || 'Unknown';
    const created = room.createdAt ? new Date(room.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'Unknown';
    const iconUrl = resolveMediaUrl(room.icon || room.iconUrl || room.avatar || room.avatarUrl || room.pfp || room.pfpUrl);
    const bannerUrl = resolveMediaUrl(room.banner || room.bannerUrl);

    const images = [];
    const linkButtons = [];
    if (iconUrl) {
      images.push({ url: iconUrl, description: `${roomName} icon` });
      linkButtons.push({ label: 'Room icon', url: iconUrl });
    }
    if (bannerUrl) {
      images.push({ url: bannerUrl, description: `${roomName} banner` });
      linkButtons.push({ label: 'Room banner', url: bannerUrl });
    }

    const details = [
      `**Room ID**\n\`${safeText(room.id || lane.roomId, 80)}\``,
      `**Owner**\n${safeText(owner, 100)}`,
      `**Created**\n${created}`,
      `**Verification**\n${safeText(room.verificationLevel || 'Not provided by API', 50)}`,
    ];
    if (Number.isFinite(room.memberCount)) {
      details.push(`**Members**\n${room.memberCount}`);
    }

    return client.sendContainer(message.laneId, {
      title: roomName,
      description: safeText(room.description || 'No room description is set.', 1000),
      images,
      sections: [{ divider: true, content: details.join('\n\n') }],
      linkButtons,
    }, { replyToId: message.id });
  },
};
