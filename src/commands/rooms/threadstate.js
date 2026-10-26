import { safeText } from '../../commandUtils.js';

const operations = Object.freeze({
  archive: ['archiveThread', 'archived'],
  unarchive: ['unarchiveThread', 'unarchived'],
  lock: ['lockThread', 'locked'],
  unlock: ['unlockThread', 'unlocked'],
  pin: ['pinThread', 'pinned'],
  publish: ['publishThread', 'published'],
  delete: ['deleteThread', 'deleted'],
});

export default {
  name: 'threadstate', category: 'rooms', description: 'Archive, unarchive, lock, or unlock a forum thread.', usage: '<archive|unarchive|lock|unlock> <thread ID>', minArgs: 2, cooldown: 10,
  async execute({ client, message, args }) {
    const action = String(args[0] || '').toLowerCase();
    const threadId = String(args[1] || '').trim();
    const operation = operations[action];
    if (!operation || !/^[a-zA-Z0-9_-]{3,100}$/.test(threadId) || (action === 'delete' && String(args[2] || '').toLowerCase() !== 'confirm')) {
      return client.sendContainer(message.laneId, { title: 'Check the thread action', description: 'Use `!threadstate archive|unarchive|lock|unlock|pin|publish <thread ID>`. Permanent deletion requires `!threadstate delete <thread ID> confirm`. Veiled checks the bot’s thread permissions.' }, { replyToId: message.id });
    }
    await client[operation[0]](threadId);
    return client.sendContainer(message.laneId, { title: 'Thread updated', description: `Thread **${safeText(threadId, 100)}** was ${operation[1]}.` }, { replyToId: message.id });
  },
};
