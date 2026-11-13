import { resolveRoomMember, safeText } from '../../commandUtils.js';

const ACTION_ALIASES = Object.freeze({
  k: 'kick',
  kick: 'kick',
  b: 'ban',
  ban: 'ban',
  ub: 'unban',
  unban: 'unban',
  t: 'timeout',
  mute: 'timeout',
  timeout: 'timeout',
  ut: 'untimeout',
  unmute: 'untimeout',
  untimeout: 'untimeout',
});

export function parseTimeoutDuration(value) {
  const match = String(value || '').match(/^(\d{1,7})(s|m|h|d)$/i);
  if (!match) return null;
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2].toLowerCase()];
  const seconds = Number(match[1]) * multiplier;
  return Number.isSafeInteger(seconds) && seconds >= 60 && seconds <= 2_419_200 ? seconds : null;
}

export default {
  name: 'moderate',
  category: 'rooms',
  description: 'Kick, ban, unban, or time out a room member by ID, mention, or name.',
  aliases: ['mod'],
  usage: '<k|b|ub|t|ut|kick|ban|unban|timeout|untimeout> <uid|@mention|name> [duration] [reason]',
  minArgs: 2,
  cooldown: 8,
  async execute({ bot, client, message, args }) {
    const rawAction = String(args[0] || '').toLowerCase();
    const action = ACTION_ALIASES[rawAction];
    const rawTarget = String(args[1] || '').trim();
    if (!action || !rawTarget) {
      return client.sendContainer(message.laneId, {
        title: 'Check the moderation command',
        description: 'Use `mod k|b|ub|t|ut <user ID | @mention | username> [duration] [reason]`. Timeout durations are 1m–28d. Veiled checks moderation permissions and member hierarchy.',
      }, { replyToId: message.id });
    }

    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });

    const resolved = await resolveRoomMember(client, lane.roomId, rawTarget);
    if (!resolved?.userId) {
      return client.sendContainer(message.laneId, {
        title: 'Member not found',
        description: `Could not resolve **${safeText(rawTarget, 80)}** to a room member or valid user ID.`,
      }, { replyToId: message.id });
    }
    const { userId, label } = resolved;

    let reason = '';
    if (action === 'kick' || action === 'ban' || action === 'unban' || action === 'untimeout') {
      reason = args.slice(2).join(' ').slice(0, 512);
    }
    if (action === 'kick') await client.kickMember(lane.roomId, userId, reason);
    else if (action === 'ban') await client.banMember(lane.roomId, userId, reason ? { reason } : {});
    else if (action === 'unban') await client.unbanMember(lane.roomId, userId);
    else if (action === 'untimeout') await client.removeMemberTimeout(lane.roomId, userId);
    else {
      const duration = parseTimeoutDuration(args[2]);
      if (duration === null) {
        return client.sendContainer(message.laneId, {
          title: 'Invalid timeout duration',
          description: 'Use seconds, minutes, hours, or days, such as `10m`, `2h`, or `1d`. Timeouts must be between 1 minute and 28 days.',
        }, { replyToId: message.id });
      }
      reason = args.slice(3).join(' ').slice(0, 512);
      await client.timeoutMember(lane.roomId, userId, duration, reason);
    }
    return client.sendContainer(message.laneId, {
      title: 'Moderation action completed',
      description: `**${safeText(action, 20)}** was applied to **${safeText(label || userId, 100)}** (\`${safeText(userId, 80)}\`)${reason ? `\nReason: ${safeText(reason, 240)}` : ''}.`,
    }, { replyToId: message.id });
  },
};
