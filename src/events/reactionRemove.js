export default {
  name: 'MESSAGE_REACTION_REMOVE',
  async execute(bot, data) {
    const roomId = data?.roomId || data?.room?.id;
    const userId = data?.userId || data?.user?.id;
    const emoji = data?.emoji || data?.reaction?.emoji;
    if (!roomId || !userId || !emoji || typeof bot.api?.getRoleAutomation !== 'function') return;
    const payload = await bot.api.getRoleAutomation(roomId).catch(() => ({}));
    for (const rule of (Array.isArray(payload?.rules) ? payload.rules : []).filter((r) => r.enabled && r.ruleType === 'REACTION_ROLE' && String(r.trigger) === String(emoji))) {
      await bot.api.removeRole(roomId, userId, rule.roleId).catch((error) => console.warn('[RoleAutomation] reaction remove failed:', error?.message || error));
    }
  },
};
