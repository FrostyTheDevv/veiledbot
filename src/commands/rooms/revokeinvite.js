import { safeText } from '../../commandUtils.js';

export function isInviteCode(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,100}$/.test(value);
}

export default {
  name: 'revokeinvite', category: 'rooms', description: 'Revoke an invite for the room this lane belongs to.', usage: '<invite code>', minArgs: 1, cooldown: 8,
  async execute({ client, message, args }) {
    const code = String(args[0] || '').trim();
    if (!isInviteCode(code)) {
      return client.sendContainer(message.laneId, { title: 'Invalid invite code', description: 'Use the code from an invite in this room. The code may contain letters, numbers, hyphens, or underscores.' }, { replyToId: message.id });
    }
    await client.revokeInvite(code);
    return client.sendContainer(message.laneId, { title: 'Invite revoked', description: `Invite **${safeText(code, 100)}** was revoked.` }, { replyToId: message.id });
  },
};
