import { createContainer } from '../../containers.js';
import { resolveRoomMember, safeText, valueArray } from '../../commandUtils.js';

const idPattern = /^[a-zA-Z0-9_-]{3,100}$/;

const ROLE_ACTIONS = Object.freeze([
  { value: 'overview', label: 'Walkthrough Overview' },
  { value: 'create', label: '1. Create a New Role' },
  { value: 'rename', label: '2. Rename an Existing Role' },
  { value: 'edit', label: '3. Edit Role Appearance' },
  { value: 'assign', label: '4. Assign a Role to a Member' },
  { value: 'remove', label: '5. Remove a Role from a Member' },
  { value: 'reorder', label: '6. Reorder Role Position' },
  { value: 'delete', label: '7. Delete a Role' },
]);

export function buildRoleConfigWalkthrough({
  step = 'overview',
  roles = [],
  members = [],
  selectedRoleId = null,
  selectedUserId = null,
  selectedPosition = null,
  statusMessage = null,
  prefix = '!',
} = {}) {
  const usableRoles = roles.filter((role) => role?.id && role.name !== '@everyone');
  const activeRole = usableRoles.find((r) => r.id === selectedRoleId) || usableRoles[0] || null;
  const activeRoleId = activeRole?.id || selectedRoleId || null;

  const usableMembers = members.filter((m) => m?.userId || m?.User?.id);
  const activeMember = usableMembers.find((m) => (m.userId || m.User?.id) === selectedUserId) || usableMembers[0] || null;
  const activeUserId = activeMember?.userId || activeMember?.User?.id || selectedUserId || null;

  const actionMenu = {
    type: 1,
    components: [{
      type: 3,
      custom_id: 'veiledbot:rolec:action',
      placeholder: 'Select a role configuration step',
      options: ROLE_ACTIONS.map(({ value, label }) => ({
        label,
        value,
        default: value === step,
      })),
    }],
  };

  const actionRows = [actionMenu];
  const sections = [];

  if (statusMessage) {
    sections.push({ divider: true, content: statusMessage });
  }

  if (step === 'overview') {
    const rolePreview = usableRoles.slice(0, 8).map((r) => `• **${safeText(r.name, 60)}** (\`${safeText(r.id, 40)}\`)${Number.isInteger(r.position) ? ` — pos ${r.position}` : ''}`).join('\n') || 'No custom roles found in this room yet.';
    sections.push({
      divider: true,
      content: `**Current Room Roles (${usableRoles.length})**\n${rolePreview}`,
    });
    sections.push({
      divider: true,
      content: [
        '**Quick CLI Commands**',
        `• \`${prefix}rolec create <Role Name>\``,
        `• \`${prefix}rolec rename <role ID> | <New Name>\``,
        `• \`${prefix}rolec assign <@member or ID> <role ID or name>\``,
        `• \`${prefix}rolec remove <@member or ID> <role ID or name>\``,
        `• \`${prefix}rolec reorder <role ID> <position>\``,
        `• \`${prefix}rolec delete <role ID> confirm\``,
      ].join('\n'),
    });
  } else if (step === 'create') {
    sections.push({
      divider: true,
      content: `**Step: Create a Role**\nPick a preset role button below to create it immediately, or run:\n\`${prefix}rolec create <Role Name>\``,
    });
    actionRows.push({
      type: 1,
      components: [
        { type: 2, style: 1, label: 'Create "Moderator"', custom_id: 'veiledbot:rolec:quickcreate:Moderator' },
        { type: 2, style: 1, label: 'Create "VIP"', custom_id: 'veiledbot:rolec:quickcreate:VIP' },
        { type: 2, style: 1, label: 'Create "Helper"', custom_id: 'veiledbot:rolec:quickcreate:Helper' },
        { type: 2, style: 2, label: 'Back', custom_id: 'veiledbot:rolec:home' },
      ],
    });
  } else if (step === 'rename') {
    sections.push({
      divider: true,
      content: activeRoleId
        ? `**Step: Rename Role**\nSelected role: **${safeText(activeRole?.name || activeRoleId, 60)}** (\`${safeText(activeRoleId, 50)}\`)\n\nRun this command to set its new name:\n\`${prefix}rolec rename ${safeText(activeRoleId, 50)} | <New Role Name>\``
        : `**Step: Rename Role**\nNo custom roles available to rename yet. Create one first with \`${prefix}rolec create <Name>\`.`,
    });
    if (usableRoles.length > 0) {
      actionRows.push({
        type: 1,
        components: [{
          type: 3,
          custom_id: 'veiledbot:rolec:role:rename',
          placeholder: 'Select a role to get its rename command',
          options: usableRoles.slice(0, 25).map((r) => ({
            label: String(r.name || r.id).slice(0, 100),
            value: String(r.id).slice(0, 80),
            default: r.id === activeRoleId,
          })),
        }],
      });
    }
  } else if (step === 'edit') {
    sections.push({ divider: true, content: `**Step: Edit Role Appearance**\nSelect a role, then use:\n\`${prefix}role edit <role ID> | <name> | <hex color> | <hoist true/false> | <mentionable true/false>\`` });
    if (usableRoles.length > 0) actionRows.push({ type: 1, components: [{ type: 3, custom_id: 'veiledbot:rolec:role:edit', placeholder: 'Select a role to edit', options: usableRoles.slice(0, 25).map((r) => ({ label: String(r.name || r.id).slice(0, 100), value: String(r.id).slice(0, 80), default: r.id === activeRoleId })) }] });
  } else if (step === 'assign' || step === 'remove') {
    const verb = step === 'assign' ? 'Assign' : 'Remove';
    sections.push({
      divider: true,
      content: `**Step: ${verb} Role**\n**Selected Role:** ${activeRole ? `${safeText(activeRole.name, 60)} (\`${safeText(activeRoleId, 40)}\`)` : 'None'}\n**Selected Member:** ${activeMember ? `${safeText(activeMember.nickname || activeMember.User?.displayName || activeMember.User?.username || activeUserId, 60)} (\`${safeText(activeUserId, 40)}\`)` : 'None'}`,
    });
    if (usableRoles.length > 0) {
      actionRows.push({
        type: 1,
        components: [{
          type: 3,
          custom_id: `veiledbot:rolec:role:${step}`,
          placeholder: `1. Select role to ${step}`,
          options: usableRoles.slice(0, 25).map((r) => ({
            label: String(r.name || r.id).slice(0, 100),
            value: String(r.id).slice(0, 80),
            default: r.id === activeRoleId,
          })),
        }],
      });
    }
    if (usableMembers.length > 0) {
      actionRows.push({
        type: 1,
        components: [{
          type: 3,
          custom_id: `veiledbot:rolec:member:${step}`,
          placeholder: '2. Select target room member',
          options: usableMembers.slice(0, 25).map((m) => {
            const uid = String(m.userId || m.User?.id);
            const name = String(m.nickname || m.User?.displayName || m.User?.username || uid).slice(0, 100);
            return {
              label: name,
              value: uid.slice(0, 80),
              default: uid === activeUserId,
            };
          }),
        }],
      });
    }
    if (activeRoleId && activeUserId && /^[a-zA-Z0-9_-]{3,35}$/.test(activeRoleId) && /^[a-zA-Z0-9_-]{3,35}$/.test(activeUserId)) {
      actionRows.push({
        type: 1,
        components: [
          {
            type: 2,
            style: step === 'assign' ? 3 : 4,
            label: `${verb} Role Now`,
            custom_id: `veiledbot:rolec:exec:${step}:${activeRoleId}:${activeUserId}`,
          },
          { type: 2, style: 2, label: 'Back', custom_id: 'veiledbot:rolec:home' },
        ],
      });
    }
  } else if (step === 'reorder') {
    const pos = Number.isInteger(selectedPosition) ? selectedPosition : (activeRole?.position ?? 1);
    sections.push({
      divider: true,
      content: `**Step: Reorder Role Position**\n**Selected Role:** ${activeRole ? `${safeText(activeRole.name, 60)} (\`${safeText(activeRoleId, 40)}\`)` : 'None'}\n**Target Position:** ${pos}`,
    });
    if (usableRoles.length > 0) {
      actionRows.push({
        type: 1,
        components: [{
          type: 3,
          custom_id: 'veiledbot:rolec:role:reorder',
          placeholder: '1. Select role to reorder',
          options: usableRoles.slice(0, 25).map((r) => ({
            label: String(r.name || r.id).slice(0, 100),
            value: String(r.id).slice(0, 80),
            default: r.id === activeRoleId,
          })),
        }],
      });
      actionRows.push({
        type: 1,
        components: [{
          type: 3,
          custom_id: 'veiledbot:rolec:pos',
          placeholder: '2. Select new hierarchy position',
          options: Array.from({ length: Math.min(15, Math.max(5, usableRoles.length + 2)) }, (_, idx) => ({
            label: `Position ${idx + 1}`,
            value: String(idx + 1),
            default: idx + 1 === pos,
          })),
        }],
      });
      if (activeRoleId && /^[a-zA-Z0-9_-]{3,35}$/.test(activeRoleId)) {
        actionRows.push({
          type: 1,
          components: [
            { type: 2, style: 3, label: `Apply Position ${pos}`, custom_id: `veiledbot:rolec:exec:reorder:${activeRoleId}:${pos}` },
            { type: 2, style: 2, label: 'Back', custom_id: 'veiledbot:rolec:home' },
          ],
        });
      }
    }
  } else if (step === 'delete') {
    sections.push({
      divider: true,
      content: activeRole
        ? `**Step: Delete Role**\nSelected role: **${safeText(activeRole.name, 60)}** (\`${safeText(activeRoleId, 40)}\`)\nClick **Confirm Delete** below to permanently delete this role.`
        : 'No custom roles available to delete.',
    });
    if (usableRoles.length > 0) {
      actionRows.push({
        type: 1,
        components: [{
          type: 3,
          custom_id: 'veiledbot:rolec:role:delete',
          placeholder: 'Select role to delete',
          options: usableRoles.slice(0, 25).map((r) => ({
            label: String(r.name || r.id).slice(0, 100),
            value: String(r.id).slice(0, 80),
            default: r.id === activeRoleId,
          })),
        }],
      });
      if (activeRoleId && /^[a-zA-Z0-9_-]{3,35}$/.test(activeRoleId)) {
        actionRows.push({
          type: 1,
          components: [
            { type: 2, style: 4, label: 'Confirm Delete Role', custom_id: `veiledbot:rolec:exec:delete:${activeRoleId}:confirm` },
            { type: 2, style: 2, label: 'Cancel', custom_id: 'veiledbot:rolec:home' },
          ],
        });
      }
    }
  }

  return {
    title: 'Role Configuration Walkthrough',
    description: 'Choose an action below to interactively configure, assign, reorder, or delete room roles.',
    sections,
    footer: 'Veiled checks Manage Roles and enforces role hierarchy rules.',
    actionRows,
  };
}

export function createRoleConfigComponents(options = {}) {
  return createContainer(buildRoleConfigWalkthrough(options));
}

export default {
  name: 'roleconfig',
  category: 'rooms',
  description: 'Interactive role setup walkthrough to create, rename, assign, remove, reorder, or delete roles.',
  aliases: ['rolec', 'roleops', 'role'],
  usage: '[create|rename|edit|assign|remove|humans|bots|all|unverified|reorder|delete ...]',
  cooldown: 5,
  async execute({ bot, client, message, args = [], rawArgs = '', prefix = '!' }) {
    const action = String(args[0] || '').toLowerCase();
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane?.roomId) throw Object.assign(new Error('Could not resolve this lane’s room.'), { status: 404 });

    if (!action || ['walkthrough', 'setup', 'menu', 'gui'].includes(action)) {
      const [rolesData, membersData] = await Promise.all([
        typeof client.getRoomRoles === 'function' ? client.getRoomRoles(lane.roomId).catch(() => ({})) : {},
        typeof client.getMembers === 'function' ? client.getMembers(lane.roomId).catch(() => ({})) : {},
      ]);
      const roles = valueArray(rolesData, 'roles');
      const members = valueArray(membersData, 'members');
      const card = buildRoleConfigWalkthrough({ step: 'overview', roles, members, prefix });
      return client.sendContainer(message.laneId, card, { replyToId: message.id });
    }

    let result;
    let summary;
    if (action === 'create') {
      const name = String(rawArgs || '').replace(/^\s*\S+\s*/, '').trim();
      if (!name || name.length > 100) return usage(client, message, prefix);
      result = await client.createRole(lane.roomId, { name });
      const role = result?.role || result;
      summary = `Created **${safeText(role.name || name, 100)}** · ID: ${safeText(role.id || '', 100)}`;
    } else if (action === 'rename') {
      const roleId = await resolveRoleId(client, lane.roomId, args[1]);
      const name = String(rawArgs || '').split('|').slice(1).join('|').trim();
      if (!idPattern.test(roleId) || !name || name.length > 100) return usage(client, message, prefix);
      await client.updateRole(roleId, { name });
      summary = `Renamed role **${safeText(roleId, 100)}** to **${safeText(name, 100)}**.`;
    } else if (['humans', 'bots', 'all', 'unverified'].includes(action)) {
      const mode = String(args[1] || '').toLowerCase();
      const roleId = await resolveRoleId(client, lane.roomId, args[2]);
      if (!['add', 'remove'].includes(mode) || !idPattern.test(roleId) || String(args[3] || '').toLowerCase() !== 'confirm') {
        return client.sendContainer(message.laneId, {
          title: 'Bulk role confirmation required',
          description: `Use \`${prefix}role ${action} add|remove <role ID> confirm\`. Bulk operations are protected because they affect many members.`,
        }, { replyToId: message.id });
      }
      const membersData = await client.getMembers(lane.roomId);
      const members = valueArray(membersData, 'members');
      const selected = members.filter((member) => {
        const user = member.User || member.user || {};
        if (action === 'bots') return Boolean(user.isBot || user.bot);
        if (action === 'unverified') return user.isVerified === false || member.isVerified === false;
        if (action === 'humans') return !(user.isBot || user.bot);
        return true;
      }).filter((member) => member.userId || member.User?.id || member.user?.id).slice(0, 500);
      for (const member of selected) {
        const userId = member.userId || member.User?.id || member.user?.id;
        await client[mode === 'add' ? 'assignRole' : 'removeRole'](lane.roomId, userId, roleId);
      }
      summary = `${mode === 'add' ? 'Added' : 'Removed'} role **${safeText(roleId, 100)}** for **${selected.length}** ${action} member(s).`;
    } else if (action === 'edit') {
      const roleId = await resolveRoleId(client, lane.roomId, args[1]);
      const fields = String(rawArgs || '').split('|').slice(1).map((item) => item.trim());
      const [name, color, hoist, mentionable] = fields;
      if (!idPattern.test(roleId) || !name || name.length > 100) return usage(client, message, prefix);
      const payload = { name };
      if (color) {
        if (!/^#[0-9a-f]{6}$/i.test(color)) return client.sendContainer(message.laneId, { title: 'Invalid role color', description: 'Use a six-digit hex color such as `#5865F2`.' }, { replyToId: message.id });
        payload.color = color;
      }
      if (hoist !== undefined && !['true', 'false'].includes(hoist.toLowerCase())) return usage(client, message, prefix);
      if (mentionable !== undefined && !['true', 'false'].includes(mentionable.toLowerCase())) return usage(client, message, prefix);
      if (hoist !== undefined) payload.hoist = hoist.toLowerCase() === 'true';
      if (mentionable !== undefined) payload.mentionable = mentionable.toLowerCase() === 'true';
      await client.updateRole(roleId, payload);
      summary = `Edited role **${safeText(roleId, 100)}**.`;
    } else if (action === 'assign' || action === 'remove') {
      const resolvedMember = await resolveRoomMember(client, lane.roomId, args[1]);
      const userId = resolvedMember?.userId || String(args[1] || '').trim();
      const roleId = await resolveRoleId(client, lane.roomId, args[2]);
      if (!idPattern.test(userId) || !idPattern.test(roleId)) return usage(client, message, prefix);
      await client[action === 'assign' ? 'assignRole' : 'removeRole'](lane.roomId, userId, roleId);
      summary = `${action === 'assign' ? 'Assigned' : 'Removed'} role **${safeText(roleId, 100)}** ${action === 'assign' ? 'to' : 'from'} **${safeText(userId, 100)}**.`;
    } else if (action === 'reorder') {
      const roleId = await resolveRoleId(client, lane.roomId, args[1]);
      const position = Number(args[2]);
      if (!idPattern.test(roleId) || !Number.isInteger(position) || position < 0 || position > 10_000) return usage(client, message, prefix);
      await client.reorderRoles(lane.roomId, [{ roleId, position }]);
      summary = `Requested position **${position}** for role **${safeText(roleId, 100)}**.`;
    } else if (action === 'delete') {
      const roleId = await resolveRoleId(client, lane.roomId, args[1]);
      if (!idPattern.test(roleId) || String(args[2] || '').toLowerCase() !== 'confirm') return usage(client, message, prefix);
      await client.deleteRole(roleId);
      summary = `Deleted role **${safeText(roleId, 100)}**.`;
    } else {
      return usage(client, message, prefix);
    }

    return client.sendContainer(message.laneId, {
      title: 'Role updated',
      description: `${summary}\nVeiled checks Manage Roles and enforces hierarchy and protected-role rules when changing role positions.`,
    }, { replyToId: message.id });
  },
};

async function resolveRoleId(client, roomId, input) {
  const value = String(input || '').trim().replace(/^<@&([^>]+)>$/, '$1');
  if (idPattern.test(value) && !/\s/.test(value) && value.length >= 20) return value;
  if (typeof client.getRoomRoles !== 'function') return value;
  const payload = await client.getRoomRoles(roomId).catch(() => ({}));
  const roles = valueArray(payload, 'roles').filter((role) => role?.id && role.name !== '@everyone');
  const needle = value.toLowerCase();
  const exact = roles.find((role) => String(role.name || '').toLowerCase() === needle);
  if (exact) return exact.id;
  const partial = roles.filter((role) => String(role.name || '').toLowerCase().includes(needle)).sort((a, b) => String(a.name).length - String(b.name).length);
  return partial[0]?.id || value;
}

function usage(client, message, prefix = '!') {
  return client.sendContainer(message.laneId, {
    title: 'Role Configuration',
    description: `Run \`${prefix}roleconfig\` (or \`${prefix}rolec\`) with no arguments to open the interactive walkthrough, or use:\n• \`${prefix}rolec create <name>\`\n• \`${prefix}rolec rename <role ID> | <new name>\`\n• \`${prefix}rolec edit <role ID> | <name> | <#RRGGBB> | <hoist> | <mentionable>\`\n• \`${prefix}rolec assign <user ID> <role ID>\`\n• \`${prefix}rolec remove <user ID> <role ID>\`\n• \`${prefix}role humans|bots|all|unverified add|remove <role ID> confirm\`\n• \`${prefix}rolec reorder <role ID> <position>\`\n• \`${prefix}rolec delete <role ID> confirm\`\n\nVeiled checks Manage Roles and enforces hierarchy rules for role changes and assignments.`,
  }, { replyToId: message.id });
}
