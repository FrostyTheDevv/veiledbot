import { isBotOwner, safeText } from '../../commandUtils.js';

const RULES = new Set(['links', 'caps', 'massMentions', 'spam']);

export default {
  name: 'automod',
  category: 'rooms',
  aliases: ['amod'],
  description: 'Configure Veiled-native anti-link, anti-caps, anti-mention, and anti-spam rules.',
  usage: '<status|enable|disable> [links|caps|massMentions|spam]',
  minArgs: 1,
  cooldown: 5,
  async execute({ bot, client, message, args }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    const action = String(args[0] || '').toLowerCase();
    if (action !== 'status' && !isBotOwner(bot, message.author?.id)) {
      const capabilities = await client.getLaneCapabilities(message.laneId);
      const values = capabilities?.capabilities || capabilities?.values || {};
      if (!values.manageMessages && !values.manageRoom && !values.manageChannels) {
        throw Object.assign(new Error('Manage Messages or Manage Room permission is required.'), { status: 403 });
      }
    }
    if (action === 'status') {
      const rules = bot.automod.get(lane.roomId);
      return client.sendContainer(message.laneId, {
        title: 'Automod settings',
        description: Object.entries(rules).filter(([key]) => RULES.has(key)).map(([key, value]) => `**${key}**: ${value ? 'enabled' : 'disabled'}`).join('\n'),
        footer: 'Rules are persisted locally and enforcement uses Veiled permissions.',
      }, { replyToId: message.id });
    }
    if (!['enable', 'disable'].includes(action) || !RULES.has(args[1])) {
      return client.sendContainer(message.laneId, { title: 'Automod usage', description: 'Use `!automod status`, `!automod enable <rule>`, or `!automod disable <rule>`.' }, { replyToId: message.id });
    }
    const rules = bot.automod.set(lane.roomId, args[1], action === 'enable');
    return client.sendContainer(message.laneId, {
      title: 'Automod updated',
      description: `**${safeText(args[1], 40)}** is now **${rules[args[1]] ? 'enabled' : 'disabled'}** for this room.`,
    }, { replyToId: message.id });
  },
};
