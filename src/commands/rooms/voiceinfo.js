import { safeText, valueArray } from '../../commandUtils.js';
export default {
  name: 'voiceinfo', category: 'rooms', description: 'Show participant and media status in the current voice lane.', aliases: ['vcinfo'], cooldown: 5,
  async execute({ bot, client, message }) {
    const lane = await bot.getLaneInfo(message.laneId);
    if (!lane || !['VOICE', 'STAGE'].includes(String(lane.type || '').toUpperCase())) return client.sendContainer(message.laneId, { title: 'Open a voice lane first', description: 'Run this command inside a voice or stage lane. Veiled only exposes participant details for voice lanes.' }, { replyToId: message.id });
    const data = await client.getVoiceStates(message.laneId);
    const users = valueArray(data, 'users');
    const members = lane.roomId ? valueArray(await client.getMembers(lane.roomId), 'members') : [];
    const rows = users.slice(0, 20).map((state) => {
      const member = members.find((item) => (item.userId || item.User?.id) === state.userId);
      const user = member?.User || {};
      const flags = [state.isMuted || state.isServerMuted ? 'muted' : null, state.isDeafened || state.isServerDeafened ? 'deafened' : null, state.isSelfVideo ? 'video' : null, state.isStreaming ? 'streaming' : null, state.isSuppressed ? 'suppressed' : null].filter(Boolean);
      return `• **${safeText(member?.nickname || user.displayName || user.username || state.userId, 80)}**${flags.length ? ` — ${flags.join(', ')}` : ''}`;
    });
    const count = Number.isFinite(data.userCount) ? data.userCount : users.length;
    return client.sendContainer(message.laneId, { title: `Voice: ${safeText(data.laneName || lane.name || 'Lane', 80)}`, description: rows.join('\n') || 'Nobody is in this voice lane.', footer: `${count} participant${count === 1 ? '' : 's'} · state from Veiled’s voice endpoint` }, { replyToId: message.id });
  },
};
