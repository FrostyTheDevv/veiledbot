import { safeText, valueArray } from '../../commandUtils.js';

export default {
  name: 'roleautomation',
  category: 'rooms',
  aliases: ['autorole', 'customrole', 'reactionrole', 'buttonrole', 'temprole'],
  description: 'Configure persistent autorole, custom, reaction, button, and temporary-role rules.',
  usage: '[list | add <type> <role ID> [trigger] [duration seconds] | remove <rule ID>]',
  cooldown: 4,
  async execute({ bot, client, message, args = [], prefix = '!' }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    const action = String(args[0] || 'list').toLowerCase();
    if (action === 'list') {
      const rows = valueArray(await client.getRoleAutomation(lane.roomId), 'rules');
      return client.sendContainer(message.laneId, { title: 'Role automation', description: rows.length ? rows.map((r) => `• **${safeText(r.ruleType, 40)}** · role \`${safeText(r.roleId, 50)}\`${r.trigger ? ` · ${safeText(r.trigger, 80)}` : ''} · ${r.enabled ? 'enabled' : 'disabled'} · \`${safeText(r.id, 50)}\``).join('\n') : `No rules configured.\n\`${prefix}roleautomation add AUTOROLE <role ID>\`` }, { replyToId: message.id });
    }
    if (action === 'remove') {
      if (!args[1]) return usage(client, message, prefix);
      await client.deleteRoleAutomation(lane.roomId, args[1]);
      return client.sendContainer(message.laneId, { title: 'Role automation removed', description: `Removed rule \`${safeText(args[1], 80)}\`.` }, { replyToId: message.id });
    }
    if (action !== 'add' || !args[1] || !args[2]) return usage(client, message, prefix);
    const type = String(args[1]).toUpperCase();
    if (!['AUTOROLE', 'CUSTOM_ROLE', 'REACTION_ROLE', 'BUTTON_ROLE', 'TEMPORARY_ROLE'].includes(type)) return usage(client, message, prefix);
    const payload = { roleId: args[2], ruleType: type, ...(args[3] ? { trigger: args[3] } : {}), ...(args[4] ? { durationSeconds: Number(args[4]) } : {}) };
    if (type === 'TEMPORARY_ROLE') {
      if (!args[3] || !args[4]) return usage(client, message, prefix);
      payload.config = { userId: args[3] };
      payload.expiresAt = new Date(Date.now() + Number(args[4]) * 1000).toISOString();
      payload.trigger = null;
    }
    if (payload.durationSeconds !== undefined && (!Number.isInteger(payload.durationSeconds) || payload.durationSeconds <= 0)) return usage(client, message, prefix);
    const result = await client.upsertRoleAutomation(lane.roomId, payload);
    return client.sendContainer(message.laneId, { title: 'Role automation saved', description: `Saved **${type}** for role \`${safeText(args[2], 80)}\`${args[3] ? ` with trigger **${safeText(args[3], 80)}**` : ''}.\nRule: \`${safeText(result?.rule?.id || '', 80)}\`` }, { replyToId: message.id });
  },
};

function usage(client, message, prefix) {
  return client.sendContainer(message.laneId, { title: 'Role automation usage', description: `\`${prefix}roleautomation list\`\n\`${prefix}roleautomation add AUTOROLE <role ID>\`\n\`${prefix}roleautomation add CUSTOM_ROLE <role ID> <keyword>\`\n\`${prefix}roleautomation add REACTION_ROLE <role ID> <emoji>\`\n\`${prefix}roleautomation add BUTTON_ROLE <role ID> <button key>\`\n\`${prefix}roleautomation add TEMPORARY_ROLE <role ID> <trigger> <duration seconds>\`\n\`${prefix}roleautomation remove <rule ID>\`` }, { replyToId: message.id });
}
