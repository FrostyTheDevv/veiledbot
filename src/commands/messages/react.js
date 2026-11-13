import { safeText } from '../../commandUtils.js';

export function parseAutoReactAdd(rawArgs = '') {
  const body = String(rawArgs || '').replace(/^\s*add(?:\s+|$)/i, '').trim();
  if (!body) {
    return { error: 'Provide a word or quoted phrase and an emoji. Example: `react add hello 👋` or `react add "good morning" ☀️`.' };
  }

  if (body.startsWith('"')) {
    const phraseMatch = /^"([^"]+)"\s+(\S+)$/.exec(body);
    if (!phraseMatch) {
      return { error: 'Quoted phrases must close with `"` followed by a single emoji. Example: `react add "sentence here" 🔥`.' };
    }
    const trigger = phraseMatch[1].trim();
    const emoji = phraseMatch[2].trim();
    if (!trigger) {
      return { error: 'The quoted phrase cannot be empty.' };
    }
    return { trigger, isPhrase: true, emoji };
  }

  const parts = body.split(/\s+/);
  if (parts.length !== 2 || parts[0].includes('"')) {
    return { error: 'Multi-word triggers require double quotes `""` around the phrase. Example: `react add "sentence here" 🔥` or `react add word 👍`.' };
  }

  return { trigger: parts[0], isPhrase: false, emoji: parts[1] };
}

export default {
  name: 'react',
  category: 'messages',
  description: 'Manage automatic emoji reactions for trigger words or "quoted phrases".',
  aliases: ['autoreact', 'ar'],
  usage: 'add <word | "phrase here"> <emoji> | remove <id or trigger> | list | clear',
  cooldown: 3,
  async execute({ bot, client, message, args = [], rawArgs = '', prefix = '!' }) {
    let roomId = message.roomId || null;
    if (!roomId && typeof bot?.getLaneInfo === 'function') {
      try {
        const lane = await bot.getLaneInfo(message.laneId);
        roomId = lane?.roomId || null;
      } catch {
        roomId = null;
      }
    }

    const sub = String(args[0] || 'list').toLowerCase();

    if (sub === 'list') {
      const rules = bot?.autoreact?.list(roomId, message.laneId) || [];
      const lines = rules.slice(0, 25).map((rule) => {
        const formattedTrigger = rule.isPhrase ? `"${safeText(rule.trigger, 80)}" *(phrase)*` : `\`${safeText(rule.trigger, 60)}\` *(word)*`;
        return `• **\`${rule.id}\`** — ${formattedTrigger} → ${rule.emoji}`;
      });
      return client.sendContainer(message.laneId, {
        title: `Auto-Reactions (${rules.length})`,
        description: lines.length
          ? lines.join('\n')
          : `No auto-reactions are configured yet.\n\n**Add a word trigger:** \`${prefix}react add hello 👋\`\n**Add a phrase trigger:** \`${prefix}react add "sentence here" 🔥\``,
        footer: `Remove with ${prefix}react remove <id or trigger> · Clear all with ${prefix}react clear`,
      }, { replyToId: message.id });
    }

    if (sub === 'add') {
      const parsed = parseAutoReactAdd(rawArgs);
      if (parsed.error) {
        return client.sendContainer(message.laneId, {
          title: 'Check auto-reaction format',
          description: parsed.error,
          accentColor: 0xfee75c,
        }, { replyToId: message.id });
      }
      const entry = bot.autoreact.add({
        roomId,
        laneId: message.laneId,
        trigger: parsed.trigger,
        isPhrase: parsed.isPhrase,
        emoji: parsed.emoji,
        createdBy: message.author?.id,
      });
      const label = entry.isPhrase ? `phrase **"${safeText(entry.trigger, 80)}"**` : `word **\`${safeText(entry.trigger, 60)}\`**`;
      return client.sendContainer(message.laneId, {
        title: 'Auto-reaction added',
        description: `I will now react with ${entry.emoji} whenever a message matches the ${label}.`,
        footer: `Rule ID: ${entry.id}`,
        accentColor: 0x57f287,
      }, { replyToId: message.id });
    }

    if (['remove', 'delete', 'del', 'rm'].includes(sub)) {
      const query = String(rawArgs || '').replace(/^\s*(?:remove|delete|del|rm)\s*/i, '').trim();
      if (!query) {
        return client.sendContainer(message.laneId, {
          title: 'Specify a trigger to remove',
          description: `Use \`${prefix}react remove <rule ID or trigger>\`. Check \`${prefix}react list\` for active IDs.`,
        }, { replyToId: message.id });
      }
      const removed = bot?.autoreact?.remove(roomId, message.laneId, query);
      if (!removed) {
        return client.sendContainer(message.laneId, {
          title: 'Auto-reaction not found',
          description: `No auto-reaction rule matched **${safeText(query, 80)}**. Run \`${prefix}react list\` to view active rules.`,
        }, { replyToId: message.id });
      }
      return client.sendContainer(message.laneId, {
        title: 'Auto-reaction removed',
        description: `Removed auto-reaction **\`${removed.id}\`** (${removed.isPhrase ? `"${safeText(removed.trigger, 80)}"` : `\`${safeText(removed.trigger, 60)}\``} → ${removed.emoji}).`,
      }, { replyToId: message.id });
    }

    if (sub === 'clear') {
      const count = bot?.autoreact?.clear(roomId, message.laneId) || 0;
      return client.sendContainer(message.laneId, {
        title: 'Auto-reactions cleared',
        description: `Removed **${count}** auto-reaction rule${count === 1 ? '' : 's'} for this room.`,
      }, { replyToId: message.id });
    }

    return client.sendContainer(message.laneId, {
      title: 'Auto-Reaction Commands',
      description: [
        `• \`${prefix}react add <word> <emoji>\` — react when a word appears`,
        `• \`${prefix}react add "sentence here" <emoji>\` — react when a quoted phrase appears`,
        `• \`${prefix}react remove <id or trigger>\` — remove a rule`,
        `• \`${prefix}react list\` — list active rules`,
        `• \`${prefix}react clear\` — remove all rules in this room`,
      ].join('\n'),
    }, { replyToId: message.id });
  },
};
