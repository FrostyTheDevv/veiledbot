import { safeText, valueArray } from '../../commandUtils.js';

const lifetimeSeconds = new Map([
  ['1h', 60 * 60],
  ['1d', 24 * 60 * 60],
  ['7d', 7 * 24 * 60 * 60],
  ['30d', 30 * 24 * 60 * 60],
  ['never', 0],
]);

export function parseInviteLifetime(input) {
  if (input == null || input === '') return 7 * 24 * 60 * 60;
  return lifetimeSeconds.get(String(input).toLowerCase()) ?? null;
}

export default {
  name: 'invite', category: 'rooms', description: 'Create a room invite link.', aliases: ['inv'], usage: '[1h | 1d | 7d | 30d | never]', cooldown: 10,
  async execute({ bot, client, message, args }) {
    const maxAge = parseInviteLifetime(args[0]);
    if (maxAge === null) {
      return client.sendContainer(message.laneId, {
        title: 'Choose an invite duration',
        description: 'Use `!invite 1h`, `!invite 1d`, `!invite 7d`, `!invite 30d`, or `!invite never`. The default is 7 days.',
      }, { replyToId: message.id });
    }

    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });

    let result;
    try {
      result = await client.createInvite(lane.roomId, { maxAge });
    } catch (error) {
      if (error?.status === 403 && typeof client.getRoomInvites === 'function') {
        try {
          const existing = await client.getRoomInvites(lane.roomId);
          const invites = valueArray(existing, 'invites').filter((inv) => inv?.code);
          if (invites.length) {
            const first = invites[0];
            const expLabel = first.expiresAt ? `Expires ${safeText(new Date(first.expiresAt).toLocaleString(), 80)}.` : 'Does not expire.';
            return client.sendContainer(message.laneId, {
              title: 'Room invite',
              description: `[Join Veiled](https://veiled.lol/invite/${encodeURIComponent(first.code)})\n\n${expLabel}`,
              footer: 'Using an existing room invite (grant the bot CREATE_INSTANT_INVITE to generate new ones).',
              accentColor: 0x5865f2,
            }, { replyToId: message.id });
          }
        } catch {
          // Fall through to descriptive permission error
        }
      }
      throw error;
    }

    const code = result?.invite?.code;
    if (!code) throw Object.assign(new Error('The API did not return an invite code.'), { status: 502 });
    const label = maxAge ? `Expires in ${safeText(args[0] || '7d', 8)}.` : 'Does not expire.';
    return client.sendContainer(message.laneId, {
      title: 'Room invite created',
      description: `[Join Veiled](https://veiled.lol/invite/${encodeURIComponent(code)})\n\n${label}`,
      accentColor: 0x5865f2,
    }, { replyToId: message.id });
  },
};
