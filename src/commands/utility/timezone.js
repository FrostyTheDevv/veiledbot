import { safeText } from '../../commandUtils.js';

export function formatTimeZone(timeZone, now = new Date()) {
  const value = String(timeZone || '').trim();
  if (!value || value.length > 100) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: value,
      dateStyle: 'full',
      timeStyle: 'long',
    });
    return {
      timeZone: formatter.resolvedOptions().timeZone,
      local: formatter.format(now),
      utc: now.toISOString(),
    };
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

export default {
  name: 'timezone', category: 'utility', description: 'Show the current time in an IANA time zone.', aliases: ['tz'], usage: '<Area/City>', minArgs: 1, cooldown: 3,
  async execute({ client, message, args }) {
    const result = formatTimeZone(args[0]);
    if (!result) return client.sendContainer(message.laneId, {
      title: 'Unknown time zone',
      description: 'Use an IANA name such as `America/New_York`, `Europe/Paris`, or `Asia/Tokyo`.',
    }, { replyToId: message.id });

    return client.sendContainer(message.laneId, {
      title: result.timeZone,
      description: `**Local time**\n${safeText(result.local, 120)}\n\n**UTC**\n${result.utc}`,
      footer: 'Uses the bot host’s time-zone database; daylight-saving changes are applied automatically.',
      accentColor: 0x5865f2,
    }, { replyToId: message.id });
  },
};
