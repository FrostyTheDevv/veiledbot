import { parseMentionId, safeText, valueArray } from '../../commandUtils.js';

export default {
  name: 'avatar', category: 'utility', description: 'Show a room member’s avatar link.', aliases: ['pfp'], usage: '[@member or user ID]', cooldown: 3,
  async execute({ bot, client, message, args }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not find the room for this lane.'), { status: 404 });
    const result = await client.getMembers(lane.roomId);
    const members = valueArray(result, 'members');
    const query = args[0] ? parseMentionId(args[0]).toLowerCase() : message.author.id.toLowerCase();
    const member = members.find((item) => item.userId?.toLowerCase() === query || item.User?.username?.toLowerCase() === query || item.User?.displayName?.toLowerCase() === query);
    if (!member) return client.sendContainer(message.laneId, { title: 'Member not found', description: 'Try a member mention, username, or user ID.' }, { replyToId: message.id });
    const user = member.User || {};
    const avatar = user.avatar;
    const links = avatar && /^https:\/\//i.test(avatar) ? [{ label: 'Open avatar', url: avatar }] : [];
    return client.sendContainer(message.laneId, { title: `${safeText(user.displayName || user.username || 'Member', 80)}’s avatar`, description: avatar ? `Avatar URL: ${avatar}` : 'This member has no custom avatar.', linkButtons: links }, { replyToId: message.id });
  },
};