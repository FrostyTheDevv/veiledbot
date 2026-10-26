import { displayUser, safeText, valueArray } from '../../commandUtils.js';

function validId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,100}$/.test(value);
}

export default {
  name: 'threadmembers', category: 'rooms', description: 'List or manage members of a forum thread.', usage: '<list|add|remove> <thread ID> [user ID]', minArgs: 2, cooldown: 8,
  async execute({ client, message, args }) {
    const action = String(args[0] || '').toLowerCase();
    const threadId = String(args[1] || '').trim();
    const userId = String(args[2] || '').trim();
    if (!validId(threadId) || !['list', 'add', 'remove'].includes(action) || (action !== 'list' && !validId(userId))) {
      return client.sendContainer(message.laneId, { title: 'Check the thread member command', description: 'Use `!threadmembers list <thread ID>`, `!threadmembers add <thread ID> <user ID>`, or `!threadmembers remove <thread ID> <user ID>`. Permission rules are enforced by Veiled.' }, { replyToId: message.id });
    }
    if (action === 'add') {
      await client.addThreadMember(threadId, userId);
      return client.sendContainer(message.laneId, { title: 'Thread member added', description: `Added **${safeText(userId, 100)}** to thread **${safeText(threadId, 100)}**.` }, { replyToId: message.id });
    }
    if (action === 'remove') {
      await client.removeThreadMember(threadId, userId);
      return client.sendContainer(message.laneId, { title: 'Thread member removed', description: `Removed **${safeText(userId, 100)}** from thread **${safeText(threadId, 100)}**.` }, { replyToId: message.id });
    }
    const result = await client.getThreadMembers(threadId);
    const members = valueArray(result, 'members').slice(0, 20);
    const description = members.length
      ? members.map((member) => `• ${safeText(displayUser(member), 80)}${member.isOwner ? ' · owner' : ''} · ${safeText(member.id || '', 100)}`).join('\n')
      : 'No thread members were returned.';
    return client.sendContainer(message.laneId, { title: 'Thread members', description }, { replyToId: message.id });
  },
};
