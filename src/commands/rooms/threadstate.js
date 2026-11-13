import { createContainer } from '../../containers.js';
import { safeText, valueArray } from '../../commandUtils.js';

const operations = Object.freeze({
  archive: ['archiveThread', 'archived'],
  unarchive: ['unarchiveThread', 'unarchived'],
  lock: ['lockThread', 'locked'],
  unlock: ['unlockThread', 'unlocked'],
  pin: ['pinThread', 'pinned'],
  publish: ['publishThread', 'published'],
  delete: ['deleteThread', 'deleted'],
});

export function buildThreadEditCard({ thread, threads = [], statusNote = null } = {}) {
  const activeThread = thread || threads[0] || null;
  const threadId = activeThread?.id || activeThread?.threadId || null;
  const title = activeThread?.name || activeThread?.title || (threadId ? `Thread ${threadId}` : 'Thread Editor');

  const actionRows = [];
  if (threads.length > 0) {
    actionRows.push({
      type: 1,
      components: [{
        type: 3,
        custom_id: 'veiledbot:thread:select',
        placeholder: 'Select a thread to customize',
        options: threads.slice(0, 25).map((item) => {
          const id = String(item.id || item.threadId);
          const name = String(item.name || item.title || id).slice(0, 100);
          return {
            label: name,
            value: id.slice(0, 100),
            default: id === threadId,
          };
        }),
      }],
    });
  }

  if (threadId && /^[a-zA-Z0-9_-]{3,80}$/.test(threadId)) {
    actionRows.push({
      type: 1,
      components: [
        { type: 2, style: 2, label: 'Archive', custom_id: `veiledbot:thread:archive:${threadId}` },
        { type: 2, style: 3, label: 'Unarchive', custom_id: `veiledbot:thread:unarchive:${threadId}` },
        { type: 2, style: 4, label: 'Lock', custom_id: `veiledbot:thread:lock:${threadId}` },
        { type: 2, style: 1, label: 'Unlock', custom_id: `veiledbot:thread:unlock:${threadId}` },
      ],
    });
  }

  if (!threadId) {
    return {
      title: 'Thread Editor',
      description: 'No active threads were found in this lane, or no thread ID was provided.\nRun `thread edit <thread ID>` to open the customization controls for a specific thread.',
      footer: 'Customize threads by archiving, unarchiving, locking, or unlocking.',
    };
  }

  const stateParts = [];
  if (typeof activeThread?.isArchived === 'boolean') stateParts.push(`**Archive state:** ${activeThread.isArchived ? 'Archived' : 'Active'}`);
  if (typeof activeThread?.isLocked === 'boolean') stateParts.push(`**Lock state:** ${activeThread.isLocked ? 'Locked' : 'Unlocked'}`);

  const lines = [
    statusNote ? `${statusNote}\n` : null,
    `**Thread ID:** \`${safeText(threadId, 80)}\``,
    stateParts.length ? stateParts.join(' · ') : null,
    'Use the buttons below to **Archive**, **Unarchive**, **Lock**, or **Unlock** this thread.',
  ].filter(Boolean);

  return {
    title: statusNote ? 'Thread updated' : `Thread Edit · ${safeText(title, 80)}`,
    description: lines.join('\n'),
    footer: 'Veiled checks the bot’s thread management permissions for each action.',
    actionRows,
  };
}

export function createThreadEditComponents(options = {}) {
  return createContainer(buildThreadEditCard(options));
}

export function parseThreadControl(customId) {
  const match = /^veiledbot:thread:(archive|unarchive|lock|unlock):([a-zA-Z0-9_-]{3,80})$/i.exec(customId || '');
  if (!match) return null;
  return { action: match[1].toLowerCase(), threadId: match[2] };
}

export default {
  name: 'thread',
  category: 'rooms',
  description: 'Open the interactive thread editor to archive, unarchive, lock, or unlock a thread.',
  aliases: ['threadedit', 'threadstate'],
  usage: 'edit [thread ID] | <archive|unarchive|lock|unlock> <thread ID>',
  cooldown: 5,
  async execute({ client, message, args = [] }) {
    const first = String(args[0] || '').toLowerCase();
    const second = String(args[1] || '').trim();

    // Direct action e.g. `thread archive <id>` or `thread edit archive <id>`
    const isEditPrefix = first === 'edit';
    const actionCandidate = isEditPrefix ? String(args[1] || '').toLowerCase() : first;
    const targetCandidate = isEditPrefix ? String(args[2] || '').trim() : second;
    const confirmArg = isEditPrefix ? String(args[3] || '').toLowerCase() : String(args[2] || '').toLowerCase();

    if (operations[actionCandidate]) {
      const operation = operations[actionCandidate];
      if (!/^[a-zA-Z0-9_-]{3,100}$/.test(targetCandidate) || (actionCandidate === 'delete' && confirmArg !== 'confirm')) {
        return client.sendContainer(message.laneId, {
          title: 'Check the thread action',
          description: 'Use `thread edit <thread ID>` for interactive controls, or `thread archive|unarchive|lock|unlock|pin|publish <thread ID>`. Permanent deletion requires `thread delete <thread ID> confirm`.',
        }, { replyToId: message.id });
      }
      await client[operation[0]](targetCandidate);
      const card = buildThreadEditCard({
        thread: { id: targetCandidate },
        statusNote: `Thread **${safeText(targetCandidate, 100)}** was ${operation[1]}.`,
      });
      return client.sendContainer(message.laneId, card, { replyToId: message.id });
    }

    // Interactive `thread edit [threadId]` or `thread [threadId]`
    const requestedThreadId = isEditPrefix ? second : String(args[0] || message.threadId || '').trim();
    let threads = [];
    if (typeof client.getLaneThreads === 'function') {
      try {
        const res = await client.getLaneThreads(message.laneId);
        threads = valueArray(res, 'threads');
      } catch {
        threads = [];
      }
    }

    let thread = null;
    if (requestedThreadId && /^[a-zA-Z0-9_-]{3,100}$/.test(requestedThreadId)) {
      if (typeof client.getThread === 'function') {
        try {
          const res = await client.getThread(requestedThreadId);
          thread = res?.thread || res?.data?.thread || { id: requestedThreadId };
        } catch {
          thread = { id: requestedThreadId };
        }
      } else {
        thread = { id: requestedThreadId };
      }
    } else if (threads.length > 0) {
      thread = threads[0];
    }

    const card = buildThreadEditCard({ thread, threads });
    return client.sendContainer(message.laneId, card, { replyToId: message.id });
  },
};
