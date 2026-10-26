import { safeText } from '../../commandUtils.js';

const idPattern = /^[a-zA-Z0-9_-]{3,100}$/;

export default {
  name: 'roleops', category: 'rooms', description: 'Create, rename, assign, remove, reorder, or delete a room role.',
  usage: '<create|rename|assign|remove|reorder|delete> ...', minArgs: 2, cooldown: 8,
  async execute({ bot, client, message, args, rawArgs }) {
    const action = String(args[0] || '').toLowerCase();
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });
    let result;
    let summary;
    if (action === 'create') {
      const name = String(rawArgs || '').replace(/^\s*\S+\s*/, '').trim();
      if (!name || name.length > 100) return usage(client, message);
      result = await client.createRole(lane.roomId, { name });
      const role = result?.role || result;
      summary = `Created **${safeText(role.name || name, 100)}** · ID: ${safeText(role.id || '', 100)}`;
    } else if (action === 'rename') {
      const roleId = String(args[1] || '').trim();
      const name = String(rawArgs || '').split('|').slice(1).join('|').trim();
      if (!idPattern.test(roleId) || !name || name.length > 100) return usage(client, message);
      await client.updateRole(roleId, { name });
      summary = `Renamed role **${safeText(roleId, 100)}** to **${safeText(name, 100)}**.`;
    } else if (action === 'assign' || action === 'remove') {
      const userId = String(args[1] || '').trim();
      const roleId = String(args[2] || '').trim();
      if (!idPattern.test(userId) || !idPattern.test(roleId)) return usage(client, message);
      await client[action === 'assign' ? 'assignRole' : 'removeRole'](lane.roomId, userId, roleId);
      summary = `${action === 'assign' ? 'Assigned' : 'Removed'} role **${safeText(roleId, 100)}** ${action === 'assign' ? 'to' : 'from'} **${safeText(userId, 100)}**.`;
    } else if (action === 'reorder') {
      const roleId = String(args[1] || '').trim();
      const position = Number(args[2]);
      if (!idPattern.test(roleId) || !Number.isInteger(position) || position < 0 || position > 10_000) return usage(client, message);
      await client.reorderRoles(lane.roomId, [{ roleId, position }]);
      summary = `Requested position **${position}** for role **${safeText(roleId, 100)}**.`;
    } else if (action === 'delete') {
      const roleId = String(args[1] || '').trim();
      if (!idPattern.test(roleId) || String(args[2] || '').toLowerCase() !== 'confirm') return usage(client, message);
      await client.deleteRole(roleId);
      summary = `Deleted role **${safeText(roleId, 100)}**.`;
    } else return usage(client, message);
    return client.sendContainer(message.laneId, { title: 'Role updated', description: `${summary}\nVeiled checks Manage Roles and enforces hierarchy and protected-role rules when changing role positions.` }, { replyToId: message.id });
  },
};

function usage(client, message) {
  return client.sendContainer(message.laneId, { title: 'Role command', description: 'Use `!roleops create <name>`, `!roleops rename <role ID> | <new name>`, `!roleops assign <user ID> <role ID>`, `!roleops remove <user ID> <role ID>`, `!roleops reorder <role ID> <position>`, or `!roleops delete <role ID> confirm`. Veiled checks Manage Roles and enforces hierarchy rules for role changes and assignments.' }, { replyToId: message.id });
}
