export default {
  name: 'MEMBER_JOIN',
  once: false,
  async execute(bot, data) {
    console.log('[Event: MEMBER_JOIN] Member joined:', data?.username || data?.user?.username || data);
    const roomId = data?.roomId || data?.room?.id;
    const userId = data?.userId || data?.user?.id || data?.member?.userId || data?.member?.User?.id;
    if (!roomId || !userId || typeof bot.api?.getRoleAutomation !== 'function') return;
    const payload = await bot.api.getRoleAutomation(roomId).catch(() => ({}));
    const rules = Array.isArray(payload?.rules) ? payload.rules : [];
    for (const rule of rules.filter((item) => item.enabled && item.ruleType === 'AUTOROLE')) {
      await bot.api.assignRole(roomId, userId, rule.roleId).catch((error) => console.warn('[RoleAutomation] autorole failed:', error?.message || error));
    }
  },
};
