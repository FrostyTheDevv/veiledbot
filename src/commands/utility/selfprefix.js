import { safeText } from '../../commandUtils.js';

export default {
  name: 'selfprefix',
  category: 'utility',
  description: 'Set or reset your personal command prefix.',
  aliases: ['sp', 'myprefix', 'prefix'],
  usage: '[new prefix | reset]',
  cooldown: 3,
  async execute({ bot, client, message, args }) {
    const userId = message.author.id;
    const defaultPrefix = bot.config?.commandPrefix || '!';
    const current = bot.prefixes?.get(userId);
    const input = String(args[0] || '').trim();

    if (!input) {
      return client.sendContainer(message.laneId, {
        title: 'Personal prefix',
        description: current
          ? `Your personal prefix is **\`${safeText(current, 16)}\`** (default bot prefix: \`${safeText(defaultPrefix, 16)}\`).`
          : `You do not have a personal prefix set. Currently using the bot prefix **\`${safeText(defaultPrefix, 16)}\`**.`,
        sections: [{
          divider: true,
          content: `**Set a custom prefix:** \`${safeText(current || defaultPrefix, 16)}selfprefix <prefix>\`\n**Reset to default:** \`${safeText(current || defaultPrefix, 16)}selfprefix reset\``,
        }],
        footer: 'Your personal prefix applies only to commands you run.',
      }, { replyToId: message.id });
    }

    if (['reset', 'clear', 'none', 'off', 'default'].includes(input.toLowerCase())) {
      bot.prefixes?.clear(userId);
      return client.sendContainer(message.laneId, {
        title: 'Personal prefix cleared',
        description: `Your personal prefix has been removed. Use **\`${safeText(defaultPrefix, 16)}\`** for commands.`,
      }, { replyToId: message.id });
    }

    if (input.length > 8 || /\s/.test(input)) {
      return client.sendContainer(message.laneId, {
        title: 'Invalid prefix',
        description: 'Your personal prefix must be 1–8 non-space characters (for example: `.`, `?`, `$`, or `>>`).',
        accentColor: 0xfee75c,
      }, { replyToId: message.id });
    }

    bot.prefixes?.set(userId, input);
    return client.sendContainer(message.laneId, {
      title: 'Personal prefix saved',
      description: `Your personal command prefix is now **\`${safeText(input, 16)}\`**.`,
      sections: [{
        divider: true,
        content: `Try \`${safeText(input, 16)}help\` or reset anytime with \`${safeText(input, 16)}selfprefix reset\`.`,
      }],
      accentColor: 0x57f287,
    }, { replyToId: message.id });
  },
};

