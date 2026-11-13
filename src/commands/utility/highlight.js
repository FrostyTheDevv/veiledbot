import { safeText } from '../../commandUtils.js';

export function parseHighlightBulkInput(raw = '') {
  const input = String(raw || '').trim();
  if (!input) return [];
  const items = [];
  let current = '';
  let quote = null;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ',' || ch === '|' || ch === '\n' || ch === ';') {
      const trimmed = current.trim();
      if (trimmed) items.push(trimmed);
      current = '';
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) items.push(tail);
  return items;
}

export function buildHighlightListCard(entries, { prefix = '!', title = 'Your highlights' } = {}) {
  if (!entries.length) {
    return {
      title,
      description: `You do not have any highlights yet.\n\nAdd one with \`${prefix}highlight add <word>\` or add several at once with \`${prefix}highlight configure word1, word2, "a phrase"\`.`,
      accentColor: 0x5865f2,
    };
  }

  const lines = entries.slice(0, 25).map((entry, idx) => {
    const badge = entry.prioritized ? '⭐ ' : '';
    const kind = entry.isPhrase ? 'phrase' : 'word';
    return `**${idx + 1}.** ${badge}\`${safeText(entry.trigger, 80)}\` · *${kind}* (\`${safeText(entry.id, 12)}\`)`;
  });

  return {
    title: `${title} (${entries.length})`,
    description: lines.join('\n'),
    sections: [
      {
        divider: true,
        content: [
          `**Commands**`,
          `• \`${prefix}highlight add <word>\` — add a highlight`,
          `• \`${prefix}highlight configure <w1, w2, ...>\` — add multiple at once`,
          `• \`${prefix}highlight edit <#> | <new word>\` — edit by list number`,
          `• \`${prefix}highlight prioritize <#>\` — move a highlight to #1`,
          `• \`${prefix}highlight delete <# | word>\` — remove a highlight`,
        ].join('\n'),
      },
    ],
    footer: entries.length > 25 ? `Showing the first 25 of ${entries.length} highlights.` : 'Matches are sent to your DMs in a container.',
    accentColor: 0xfee75c,
  };
}

async function resolveRoomId(bot, message) {
  if (message.roomId) return String(message.roomId);
  if (typeof bot?.getLaneInfo === 'function' && message.laneId) {
    try {
      const lane = await bot.getLaneInfo(message.laneId);
      return lane?.roomId ? String(lane.roomId) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export default {
  name: 'highlight',
  category: 'utility',
  description: 'Get a DM container whenever someone says one of your highlighted words or phrases.',
  aliases: ['hl', 'hightlight'],
  usage: '<add|delete|list|configure|edit|prioritize> ...',
  cooldown: 2,
  async execute({ bot, client, message, args, rawArgs = '', prefix = '!' }) {
    if (!bot?.highlights) {
      throw new Error('Highlight store is not initialized.');
    }

    const userId = message.author?.id;
    if (!userId) return null;

    const roomId = await resolveRoomId(bot, message);
    const sub = (args[0] || 'list').toLowerCase();
    const restRaw = String(rawArgs || '').replace(/^\S+\s*/, '').trim();

    if (sub === 'list' || sub === 'ls') {
      const entries = bot.highlights.list(userId, roomId);
      return client.sendContainer(message.laneId, buildHighlightListCard(entries, { prefix }), { replyToId: message.id });
    }

    if (sub === 'add') {
      const value = restRaw || args.slice(1).join(' ');
      if (!value.trim()) {
        return client.sendContainer(message.laneId, {
          title: 'Add a highlight',
          description: `Provide a word or phrase to highlight:\n• \`${prefix}highlight add veiled\`\n• \`${prefix}highlight add "patch notes"\``,
          accentColor: 0xfee75c,
        }, { replyToId: message.id });
      }
      const { entry, duplicate } = bot.highlights.add(userId, value, { roomId });
      return client.sendContainer(message.laneId, {
        title: duplicate ? 'Highlight already exists' : 'Highlight added',
        description: duplicate
          ? `\`${safeText(entry.trigger, 80)}\` is already in your highlight list.`
          : `Added **${entry.isPhrase ? 'phrase' : 'word'}** \`${safeText(entry.trigger, 80)}\`.\nWhen someone mentions it here, I will send a container to your DMs.`,
        footer: `ID ${entry.id}`,
        accentColor: duplicate ? 0xfee75c : 0x57f287,
      }, { replyToId: message.id });
    }

    if (sub === 'configure' || sub === 'config' || sub === 'setup' || sub === 'bulk') {
      const items = parseHighlightBulkInput(restRaw);
      if (!items.length) {
        const current = bot.highlights.list(userId, roomId);
        return client.sendContainer(message.laneId, {
          title: 'Configure multiple highlights',
          description: [
            `Add multiple words or phrases at once by separating them with commas (\`,\`), pipes (\`|\`), or new lines:`,
            `\`${prefix}highlight configure giveaway, "patch notes", tournament, update\``,
            '',
            `You currently have **${current.length}** highlight${current.length === 1 ? '' : 's'} configured.`,
          ].join('\n'),
          sections: [
            {
              divider: true,
              content: [
                `**Other actions**`,
                `• \`${prefix}highlight list\` — view numbered highlights`,
                `• \`${prefix}highlight edit <#> | <new text>\` — edit an entry`,
                `• \`${prefix}highlight prioritize <#>\` — move an entry to #1`,
                `• \`${prefix}highlight delete <# | word>\` — remove an entry`,
              ].join('\n'),
            },
          ],
          accentColor: 0x5865f2,
        }, { replyToId: message.id });
      }

      const { added, skipped, invalid } = bot.highlights.addMany(userId, items, { roomId });
      const parts = [];
      if (added.length) parts.push(`**Added (${added.length}):** ${added.map((e) => `\`${safeText(e.trigger, 50)}\``).join(', ')}`);
      if (skipped.length) parts.push(`**Already existed (${skipped.length}):** ${skipped.map((t) => `\`${safeText(t, 50)}\``).join(', ')}`);
      if (invalid.length) parts.push(`**Skipped (${invalid.length}):** ${invalid.slice(0, 5).map((m) => safeText(m, 60)).join('; ')}`);

      return client.sendContainer(message.laneId, {
        title: 'Highlights configured',
        description: parts.join('\n\n') || 'No valid highlights were provided.',
        footer: `Total highlights: ${bot.highlights.list(userId, roomId).length}`,
        accentColor: added.length ? 0x57f287 : 0xfee75c,
      }, { replyToId: message.id });
    }

    if (sub === 'delete' || sub === 'del' || sub === 'remove' || sub === 'rm') {
      const target = restRaw || args.slice(1).join(' ');
      if (!target.trim()) {
        return client.sendContainer(message.laneId, {
          title: 'Delete a highlight',
          description: `Specify a list number, ID, or word:\n\`${prefix}highlight delete 1\` or \`${prefix}highlight delete veiled\``,
          accentColor: 0xfee75c,
        }, { replyToId: message.id });
      }
      const removed = bot.highlights.remove(userId, target, roomId);
      if (!removed) {
        return client.sendContainer(message.laneId, {
          title: 'Highlight not found',
          description: `No highlight matched \`${safeText(target, 80)}\`. Run \`${prefix}highlight list\` to check your list numbers.`,
          accentColor: 0xed4245,
        }, { replyToId: message.id });
      }
      return client.sendContainer(message.laneId, {
        title: 'Highlight deleted',
        description: `Removed \`${safeText(removed.trigger, 80)}\` from your highlights.`,
        footer: `Remaining: ${bot.highlights.list(userId, roomId).length}`,
        accentColor: 0x57f287,
      }, { replyToId: message.id });
    }

    if (sub === 'edit' || sub === 'update' || sub === 'rename') {
      let target = null;
      let nextValue = null;

      if (restRaw.includes('|')) {
        const [left, ...right] = restRaw.split('|');
        target = left.trim();
        nextValue = right.join('|').trim();
      } else if (args.length >= 3) {
        target = args[1];
        nextValue = args.slice(2).join(' ');
      }

      if (!target || !nextValue) {
        return client.sendContainer(message.laneId, {
          title: 'Edit a highlight',
          description: `Use a list number (or existing word) and the new text:\n• \`${prefix}highlight edit 1 | newword\`\n• \`${prefix}highlight edit 2 "new phrase"\``,
          accentColor: 0xfee75c,
        }, { replyToId: message.id });
      }

      const updated = bot.highlights.edit(userId, target, nextValue, roomId);
      if (!updated) {
        return client.sendContainer(message.laneId, {
          title: 'Highlight not found',
          description: `No highlight matched \`${safeText(target, 80)}\`. Run \`${prefix}highlight list\` to see your list numbers.`,
          accentColor: 0xed4245,
        }, { replyToId: message.id });
      }

      return client.sendContainer(message.laneId, {
        title: 'Highlight updated',
        description: `Updated \`${safeText(updated.previous, 80)}\` → \`${safeText(updated.entry.trigger, 80)}\`.`,
        footer: `ID ${updated.entry.id}`,
        accentColor: 0x57f287,
      }, { replyToId: message.id });
    }

    if (sub === 'prioritize' || sub === 'prio' || sub === 'priority' || sub === 'top') {
      const listNum = args[1];
      const newPos = args[2] || 1;
      if (!listNum || !/^\d+$/.test(String(listNum))) {
        return client.sendContainer(message.laneId, {
          title: 'Prioritize a highlight',
          description: `Provide the list number from \`${prefix}highlight list\`:\n• \`${prefix}highlight prioritize 3\` (moves #3 to #1)\n• \`${prefix}highlight prioritize 4 2\` (moves #4 to #2)`,
          accentColor: 0xfee75c,
        }, { replyToId: message.id });
      }

      const result = bot.highlights.prioritize(userId, listNum, newPos, roomId);
      if (!result) {
        return client.sendContainer(message.laneId, {
          title: 'Highlight not found',
          description: `List item **#${safeText(listNum, 10)}** does not exist. Run \`${prefix}highlight list\` to check your list numbers.`,
          accentColor: 0xed4245,
        }, { replyToId: message.id });
      }

      return client.sendContainer(message.laneId, {
        title: '⭐ Highlight prioritized',
        description: `Moved \`${safeText(result.entry.trigger, 80)}\` from **#${result.fromPosition}** to **#${result.toPosition}**.`,
        footer: `ID ${result.entry.id}`,
        accentColor: 0xfee75c,
      }, { replyToId: message.id });
    }

    // Fallback: treat `highlight <word>`? No, better to show usage card if subcommand is unknown
    return client.sendContainer(message.laneId, {
      title: 'Highlight commands',
      description: [
        `• \`${prefix}highlight add <word>\` — add a highlight`,
        `• \`${prefix}highlight delete <# | word>\` — remove a highlight`,
        `• \`${prefix}highlight list\` — show your numbered highlights`,
        `• \`${prefix}highlight configure <w1, w2, ...>\` — add multiple highlights at once`,
        `• \`${prefix}highlight edit <#> | <new word>\` — edit an existing highlight`,
        `• \`${prefix}highlight prioritize <#>\` — move a highlight to #1 priority`,
      ].join('\n'),
      accentColor: 0x5865f2,
    }, { replyToId: message.id });
  },
};

