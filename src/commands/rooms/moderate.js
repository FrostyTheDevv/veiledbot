import { safeText } from '../../commandUtils.js';

const idPattern = /^[a-zA-Z0-9_-]{3,100}$/;

export function parseTimeoutDuration(value) {
  const match = String(value || '').match(/^(\d{1,7})(s|m|h|d)$/i);
  if (!match) return null;
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2].toLowerCase()];
  const seconds = Number(match[1]) * multiplier;
  return Number.isSafeInteger(seconds) && seconds >= 60 && seconds <= 2_419_200 ? seconds : null;
}

export default {
  name: 'moderate', category: 'rooms', description: 'Kick, ban, unban, or time out a room member.',
  usage: '<kick|ban|unban|timeout|untimeout> <user ID> [duration for timeout] [reason]', minArgs: 2, cooldown: 8,
  async execute({ bot, client, message, args }) {
    const action = String(args[0] || '').toLowerCase();
    const userId = String(args[1] || '').trim();
    if (!idPattern.test(userId) || !['kick', 'ban', 'unban', 'timeout', 'untimeout'].includes(action)) {
      return client.sendContainer(message.laneId, { title: 'Check the moderation command', description: 'Use `!moderate kick|ban|unban|timeout|untimeout <user ID> [duration] [reason]`. Timeout durations are 1m–28d. Veiled checks moderation permissions and member hierarchy.' }, { replyToId: message.id });
    }
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    let reason = '';
    if (action === 'kick' || action === 'ban' || action === 'unban' || action === 'untimeout') reason = args.slice(2).join(' ').slice(0, 512);
    if (action === 'kick') await client.kickMember(lane.roomId, userId, reason);
    else if (action === 'ban') await client.banMember(lane.roomId, userId, reason ? { reason } : {});
    else if (action === 'unban') await client.unbanMember(lane.roomId, userId);
    else if (action === 'untimeout') await client.removeMemberTimeout(lane.roomId, userId);
    else {
      const duration = parseTimeoutDuration(args[2]);
      if (duration === null) return client.sendContainer(message.laneId, { title: 'Invalid timeout duration', description: 'Use seconds, minutes, hours, or days, such as `10m`, `2h`, or `1d`. Timeouts must be between 1 minute and 28 days.' }, { replyToId: message.id });
      reason = args.slice(3).join(' ').slice(0, 512);
      await client.timeoutMember(lane.roomId, userId, duration, reason);
    }
    return client.sendContainer(message.laneId, { title: 'Moderation action completed', description: `**${safeText(action, 20)}** was applied to **${safeText(userId, 100)}**${reason ? `\nReason: ${safeText(reason, 240)}` : ''}.` }, { replyToId: message.id });
  },
};
