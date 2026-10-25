import { formatDate, parseMentionId, safeText, valueArray } from '../../commandUtils.js';

export default {
  name: 'userinfo', category: 'utility', description: 'Show a room member’s profile and roles.', aliases: ['ui', 'whois', 'user'], usage: '[@member or user ID]', cooldown: 3,
  async execute({ bot, client, message, args }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not find the room for this lane.'), { status: 404 });
    const response = await client.getMembers(lane.roomId);
    const members = valueArray(response, 'members');
    const query = args[0] ? parseMentionId(args[0]).toLowerCase() : message.author.id.toLowerCase();
    const member = members.find((item) => item.userId?.toLowerCase() === query || item.User?.username?.toLowerCase() === query || item.User?.displayName?.toLowerCase() === query || item.nickname?.toLowerCase() === query);
    if (!member) return client.sendContainer(message.laneId, { title: 'Member not found', description: 'Try a member mention, username, or user ID.' }, { replyToId: message.id });
    const user = member.User || {};
    const roles = (member.roles || []).map((role) => role.role?.name || role.name).filter((name) => name && name !== '@everyone');
    return client.sendContainer(message.laneId, {
      title: safeText(user.displayName || user.username || 'Member', 100),
      description: `@${safeText(user.username || 'unknown', 80)} · ${user.isBot ? 'Bot account' : 'User account'}`,
      sections: [{ divider: true, content: `**User ID**\n\`${safeText(member.userId, 80)}\`\n\n**Room nickname**\n${safeText(member.nickname || 'None', 100)}\n\n**Joined**\n${formatDate(member.joinedAt)}\n\n**Roles**\n${roles.length ? roles.map((role) => `\`${safeText(role, 80)}\``).join(', ') : 'No visible roles'}\n\n**Status**\n${safeText(user.status || 'Unknown', 40)}` }],
      accentColor: 0x5865f2,
    }, { replyToId: message.id });
  },
};