import { parseMentionId, resolveMediaUrl, safeText, valueArray } from '../../commandUtils.js';

export default {
  name: 'avatar', category: 'utility', description: 'Show a room member’s avatar inside a container.', aliases: ['av', 'pfp'], usage: '[@member or user ID]', cooldown: 3,
  async execute({ bot, client, message, args }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not find the room for this lane.'), { status: 404 });
    const result = await client.getMembers(lane.roomId);
    const members = valueArray(result, 'members');
    const query = args[0] ? parseMentionId(args[0]).toLowerCase() : message.author.id.toLowerCase();
    const member = members.find((item) => item.userId?.toLowerCase() === query || item.User?.username?.toLowerCase() === query || item.User?.displayName?.toLowerCase() === query || item.nickname?.toLowerCase() === query);
    if (!member) return client.sendContainer(message.laneId, { title: 'Member not found', description: 'Try a member mention, username, or user ID.' }, { replyToId: message.id });
    const user = member.User || member.user || {};
    const displayName = safeText(member.nickname || user.displayName || user.username || 'Member', 80);
    const avatar = resolveMediaUrl(user.avatar || user.avatarUrl || user.avatar_url || member.avatar);
    const links = avatar ? [{ label: 'Open avatar', url: avatar }] : [];
    return client.sendContainer(message.laneId, {
      title: `${displayName}’s avatar`,
      description: avatar ? `@${safeText(user.username || displayName, 60)}` : 'This member has no custom avatar set.',
      ...(avatar ? { images: [{ url: avatar, description: `${displayName}'s avatar` }] } : {}),
      linkButtons: links,
    }, { replyToId: message.id });
  },
};
