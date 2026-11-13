import { isBotOwner, safeText, valueArray } from '../../commandUtils.js';

const summarize = (items, key) => items.reduce((counts, item) => {
  const value = String(item[key] || 'other').toLowerCase();
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {});

export default {
  name: 'roomstats',
  category: 'rooms',
  description: 'Summarize the room member and lane data available to the bot (bot owner only).',
  aliases: ['serverstats'],
  ownerOnly: true,
  cooldown: 10,
  async execute({ bot, client, message }) {
    if (message?.author?.id && !isBotOwner(bot, message.author.id)) {
      return client.sendContainer(message.laneId, {
        title: 'Bot owner only',
        description: 'Only the bot owner can run room statistics.',
        accentColor: 0xed4245,
      }, { replyToId: message.id });
    }
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    const [memberData, laneData] = await Promise.all([client.getMembers(lane.roomId), client.getLanes(lane.roomId)]);
    const members = valueArray(memberData, 'members');
    const lanes = valueArray(laneData, 'lanes');
    const types = summarize(lanes, 'type');
    const laneBreakdown = Object.entries(types).map(([type, count]) => `• ${safeText(type, 24)}: **${count}**`).join('\n') || 'No lanes returned.';
    const total = Number.isFinite(memberData?.total) ? ` of ${memberData.total}` : '';
    return client.sendContainer(message.laneId, {
      title: `${safeText(lane.roomName, 90)} overview`,
      description: `**Members returned:** ${members.length}${total}\n**Bots in returned member data:** ${members.filter((member) => Boolean(member.User?.isBot || member.user?.isBot)).length}\n**Lanes returned:** ${lanes.length}`,
      sections: [{ divider: true, content: `**Lane types**\n${laneBreakdown}` }],
      footer: 'Counts reflect API results; member data may be paginated.',
    }, { replyToId: message.id });
  },
};
