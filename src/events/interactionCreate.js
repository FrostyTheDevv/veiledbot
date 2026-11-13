import { createHelpComponents, parseHelpControl } from '../commands/utility/help.js';
import { createTimezoneComponents, inferRegionForZone, TIMEZONE_REGIONS } from '../commands/utility/timezone.js';
import { createCardBuilderComponents, createDefaultCardDraft, getCardDraft } from '../commands/utility/card.js';
import { createThreadEditComponents, parseThreadControl } from '../commands/rooms/threadstate.js';
import { createRoleConfigComponents } from '../commands/rooms/roleops.js';
import { createHistoryComponents, parseHistoryControl } from '../commands/messages/history.js';
import { safeText, valueArray } from '../commandUtils.js';

export default {
  name: 'INTERACTION_CREATE',
  async execute(bot, interaction) {
    const customId = interaction?.data?.custom_id;
    const interactionId = interaction?.interaction_id || interaction?.id;
    if (!interactionId || !customId) return;

    const user = interaction?.user || interaction?.member?.user || {};
    const userId = user.id || 'default';
    const userName = user.displayName || user.username || null;
    const laneId = interaction?.channel_id || interaction?.laneId || interaction?.message?.laneId || null;
    const prefix = bot?.prefixes?.get?.(userId) || bot?.config?.commandPrefix || '!';

    try {
      const buttonRole = /^veiledbot:rolebutton:(.+)$/.exec(customId);
      if (buttonRole) {
        const lane = laneId ? await bot.getLaneInfo(laneId) : null;
        const roomId = lane?.roomId;
        if (!roomId || typeof bot.api?.getRoleAutomation !== 'function') return;
        const rules = await bot.api.getRoleAutomation(roomId).catch(() => ({}));
        const rule = (Array.isArray(rules?.rules) ? rules.rules : []).find((r) => r.enabled && r.ruleType === 'BUTTON_ROLE' && String(r.trigger) === buttonRole[1]);
        if (!rule) return;
        const current = await bot.api.getMemberRoles(roomId, userId).catch(() => ({}));
        const roleIds = valueArray(current, 'roles').map((r) => r.roleId || r.id);
        if (roleIds.includes(rule.roleId)) await bot.api.removeRole(roomId, userId, rule.roleId);
        else await bot.api.assignRole(roomId, userId, rule.roleId);
        await bot.api.respondToInteraction(interactionId, { type: 'reply', content: `Role ${roleIds.includes(rule.roleId) ? 'removed' : 'added'}.`, ephemeral: true });
        return;
      }

      // 1. Help menu controls
      const helpSelection = customId === 'veiledbot:help:category'
        ? { kind: 'category', category: interaction.data.values?.[0] || 'home' }
        : parseHelpControl(customId);
      if (helpSelection) {
        const page = helpSelection.kind === 'page' ? helpSelection.page : 0;
        const category = helpSelection.kind === 'home' ? 'home' : helpSelection.category;
        await bot.api.respondToInteraction(interactionId, {
          type: 'update',
          components: createHelpComponents(bot, category, prefix, page),
        });
        return;
      }

      // 2. Timezone region & zone controls
      if (customId === 'veiledbot:tz:region') {
        const regionKey = interaction.data.values?.[0] || 'americas';
        const defaultZone = TIMEZONE_REGIONS[regionKey]?.zones?.[0]?.value || 'America/New_York';
        await bot.api.respondToInteraction(interactionId, {
          type: 'update',
          components: createTimezoneComponents({ regionKey, timeZone: defaultZone, userName }),
        });
        return;
      }
      if (customId === 'veiledbot:tz:zone') {
        const selectedZone = interaction.data.values?.[0] || 'America/New_York';
        if (userId !== 'default') bot?.timezones?.set?.(userId, selectedZone);
        await bot.api.respondToInteraction(interactionId, {
          type: 'update',
          components: createTimezoneComponents({
            regionKey: inferRegionForZone(selectedZone),
            timeZone: selectedZone,
            userName,
          }),
        });
        return;
      }

      // 3. Thread editor controls
      if (customId === 'veiledbot:thread:select') {
        const selectedThreadId = interaction.data.values?.[0];
        let threads = [];
        if (laneId && typeof bot.api?.getLaneThreads === 'function') {
          const res = await bot.api.getLaneThreads(laneId).catch(() => ({}));
          threads = valueArray(res, 'threads');
        }
        let thread = threads.find((t) => (t.id || t.threadId) === selectedThreadId) || { id: selectedThreadId };
        if (selectedThreadId && typeof bot.api?.getThread === 'function') {
          const res = await bot.api.getThread(selectedThreadId).catch(() => null);
          if (res?.thread || res?.data?.thread) thread = res.thread || res.data.thread;
        }
        await bot.api.respondToInteraction(interactionId, {
          type: 'update',
          components: createThreadEditComponents({ thread, threads }),
        });
        return;
      }
      const threadControl = parseThreadControl(customId);
      if (threadControl) {
        const methodMap = {
          archive: ['archiveThread', 'archived'],
          unarchive: ['unarchiveThread', 'unarchived'],
          lock: ['lockThread', 'locked'],
          unlock: ['unlockThread', 'unlocked'],
        };
        const [methodName, pastTense] = methodMap[threadControl.action];
        await bot.api[methodName](threadControl.threadId);
        let thread = {
          id: threadControl.threadId,
          ...(threadControl.action === 'archive' ? { isArchived: true } : {}),
          ...(threadControl.action === 'unarchive' ? { isArchived: false } : {}),
          ...(threadControl.action === 'lock' ? { isLocked: true } : {}),
          ...(threadControl.action === 'unlock' ? { isLocked: false } : {}),
        };
        if (typeof bot.api?.getThread === 'function') {
          const fetched = await bot.api.getThread(threadControl.threadId).catch(() => null);
          if (fetched?.thread || fetched?.data?.thread) thread = fetched.thread || fetched.data.thread;
        }
        await bot.api.respondToInteraction(interactionId, {
          type: 'update',
          components: createThreadEditComponents({
            thread,
            statusNote: `Thread **${safeText(threadControl.threadId, 80)}** was ${pastTense}.`,
          }),
        });
        return;
      }

      // 4. History pagination controls
      const historyControl = parseHistoryControl(customId);
      if (historyControl) {
        const targetLane = laneId || historyControl.laneId;
        const raw = await bot.api.getMessages(targetLane);
        const messages = valueArray(raw, 'messages');
        await bot.api.respondToInteraction(interactionId, {
          type: 'update',
          components: createHistoryComponents({
            laneId: targetLane,
            messages,
            requestedPage: historyControl.page,
          }),
        });
        return;
      }

      // 5. Card builder controls
      if (customId.startsWith('veiledbot:card:')) {
        const draft = getCardDraft(bot, userId);
        if (customId === 'veiledbot:card:color') {
          const val = interaction.data.values?.[0] || '0x5865f2';
          draft.accentColor = Number.parseInt(val.replace(/^0x/i, ''), 16) || 0x5865f2;
        } else if (customId === 'veiledbot:card:option') {
          const opt = interaction.data.values?.[0];
          if (opt === 'toggle_dividers') draft.dividers = !draft.dividers;
          else if (opt === 'toggle_spacing') draft.spacing = draft.spacing === 2 ? 1 : 2;
          else if (opt === 'toggle_footer_divider') draft.footerDivider = !draft.footerDivider;
          else if (opt === 'toggle_spoiler') draft.spoiler = !draft.spoiler;
          else if (opt === 'clear_thumbnail') draft.thumbnail = null;
          else if (opt === 'clear_images') draft.images = [];
          else if (opt === 'clear_sections') draft.sections = [];
          else if (opt === 'clear_buttons') draft.linkButtons = [];
          else if (opt === 'clear_footer') draft.footer = '';
        } else if (customId === 'veiledbot:card:divider') {
          draft.dividers = !draft.dividers;
        } else if (customId === 'veiledbot:card:spoiler') {
          draft.spoiler = !draft.spoiler;
        } else if (customId === 'veiledbot:card:reset') {
          bot.cardDrafts?.set(String(userId), createDefaultCardDraft());
        } else if (customId === 'veiledbot:card:publish') {
          await bot.api.respondToInteraction(interactionId, {
            type: 'update',
            components: createCardBuilderComponents(bot, userId, { includeBuilderControls: false, prefix }),
          });
          return;
        }
        await bot.api.respondToInteraction(interactionId, {
          type: 'update',
          components: createCardBuilderComponents(bot, userId, { includeBuilderControls: true, prefix }),
        });
        return;
      }

      // 6. RoleConfig walkthrough controls
      if (customId.startsWith('veiledbot:rolec:')) {
        if (!bot.roleDrafts) bot.roleDrafts = new Map();
        const state = bot.roleDrafts.get(userId) || { step: 'overview', selectedRoleId: null, selectedUserId: null, selectedPosition: 1 };
        bot.roleDrafts.set(userId, state);

        let roomId = interaction?.guild_id || interaction?.roomId || null;
        if (!roomId && laneId && typeof bot.getLaneInfo === 'function') {
          const lane = await bot.getLaneInfo(laneId).catch(() => null);
          roomId = lane?.roomId || null;
        }

        let statusMessage = null;
        if (customId === 'veiledbot:rolec:home') {
          state.step = 'overview';
        } else if (customId === 'veiledbot:rolec:action') {
          state.step = interaction.data.values?.[0] || 'overview';
        } else if (customId.startsWith('veiledbot:rolec:role:')) {
          state.step = customId.split(':')[3] || state.step;
          state.selectedRoleId = interaction.data.values?.[0] || null;
        } else if (customId.startsWith('veiledbot:rolec:member:')) {
          state.step = customId.split(':')[3] || state.step;
          state.selectedUserId = interaction.data.values?.[0] || null;
        } else if (customId === 'veiledbot:rolec:pos') {
          state.selectedPosition = Number(interaction.data.values?.[0]) || 1;
        } else if (customId.startsWith('veiledbot:rolec:quickcreate:')) {
          const roleName = customId.slice('veiledbot:rolec:quickcreate:'.length);
          if (roomId && roleName) {
            const created = await bot.api.createRole(roomId, { name: roleName });
            const role = created?.role || created;
            statusMessage = `✅ Created role **${safeText(role?.name || roleName, 60)}** (\`${safeText(role?.id || '', 40)}\`).`;
          }
        } else if (customId.startsWith('veiledbot:rolec:exec:')) {
          const [, , , execAction, roleId, target] = customId.split(':');
          if (roomId && roleId) {
            if (execAction === 'assign' && target) {
              await bot.api.assignRole(roomId, target, roleId);
              statusMessage = `✅ Assigned role \`${safeText(roleId, 40)}\` to \`${safeText(target, 40)}\`.`;
            } else if (execAction === 'remove' && target) {
              await bot.api.removeRole(roomId, target, roleId);
              statusMessage = `✅ Removed role \`${safeText(roleId, 40)}\` from \`${safeText(target, 40)}\`.`;
            } else if (execAction === 'reorder' && target) {
              const pos = Number(target) || 1;
              await bot.api.reorderRoles(roomId, [{ roleId, position: pos }]);
              statusMessage = `✅ Updated role \`${safeText(roleId, 40)}\` to position **${pos}**.`;
            } else if (execAction === 'delete' && target === 'confirm') {
              await bot.api.deleteRole(roleId);
              statusMessage = `✅ Deleted role \`${safeText(roleId, 40)}\`.`;
              state.selectedRoleId = null;
            }
          }
        }

        const [rolesData, membersData] = await Promise.all([
          roomId && typeof bot.api?.getRoomRoles === 'function' ? bot.api.getRoomRoles(roomId).catch(() => ({})) : {},
          roomId && typeof bot.api?.getMembers === 'function' ? bot.api.getMembers(roomId).catch(() => ({})) : {},
        ]);

        await bot.api.respondToInteraction(interactionId, {
          type: 'update',
          components: createRoleConfigComponents({
            step: state.step,
            roles: valueArray(rolesData, 'roles'),
            members: valueArray(membersData, 'members'),
            selectedRoleId: state.selectedRoleId,
            selectedUserId: state.selectedUserId,
            selectedPosition: state.selectedPosition,
            statusMessage,
            prefix,
          }),
        });
      }
    } catch (error) {
      console.error(`[Interaction] Handler failed for ${customId}: ${error?.message || 'unknown error'}`);
    }
  },
};
