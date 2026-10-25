import { errorCard, safeText } from '../commandUtils.js';

function mentionedUsers(message) {
  const mentions = message?.mentions;
  if (Array.isArray(mentions)) return mentions;
  if (Array.isArray(mentions?.users)) return mentions.users;
  if (mentions?.users && typeof mentions.users === 'object') return Object.values(mentions.users);
  if (mentions && typeof mentions === 'object') return Object.values(mentions);
  return [];
}

export default {
  name: 'MESSAGE_CREATE',
  async execute(bot, message) {
    if (!message?.laneId || !message.author?.id || message.author.isBot || message.webhookId || message.author.id === bot.user?.id) return;
    const content = String(message.content || '').trim();
    if (!content) return;
    const prefix = bot.config.commandPrefix;
    const calledAfk = content.startsWith(prefix) && /^afk(?:\s|$)/i.test(content.slice(prefix.length));

    const mentionedAfk = [];
    for (const entry of mentionedUsers(message)) {
      const id = String(entry?.id || entry?.userId || entry || '');
      const state = bot.afk.get(id);
      if (state && id !== message.author.id && bot.afk.shouldNotify(message.author.id, id)) {
        mentionedAfk.push({ name: entry?.displayName || entry?.username || entry?.name || id, reason: state.reason });
      }
      if (mentionedAfk.length >= 3) break;
    }
    if (mentionedAfk.length) {
      const details = mentionedAfk.map((entry) => `• **${safeText(entry.name, 80)}** is away${entry.reason ? `: ${safeText(entry.reason, 240)}` : '.'}`).join('\n');
      await bot.api.sendContainer(message.laneId, { title: 'Away right now', description: details }, { replyToId: message.id });
    }

    if (bot.afk.get(message.author.id) && !calledAfk) {
      bot.afk.clear(message.author.id);
      await bot.api.sendContainer(message.laneId, { title: 'Welcome back', description: `${safeText(message.author.displayName || message.author.username || 'You', 80)} is no longer marked as away.` }, { replyToId: message.id });
    }

    const mentions = [bot.user?.id && `<@${bot.user.id}>`, bot.user?.id && `<@!${bot.user.id}>`, bot.user?.username && `@${bot.user.username}`, bot.user?.displayName && `@${bot.user.displayName}`].filter(Boolean);
    const matchedMention = mentions.find((pattern) => content.toLowerCase().startsWith(pattern.toLowerCase()));
    const isMentioned = Boolean(matchedMention || mentionedUsers(message).some((item) => (item?.id || item?.userId || item) === bot.user?.id));
    let input = null;
    if (matchedMention) input = content.slice(matchedMention.length).trim() || 'help';
    else if (content.startsWith(prefix)) input = content.slice(prefix.length).trim();
    else if (isMentioned) input = 'help';
    else return;
    const match = input.match(/^(\S+)(?:\s+([\s\S]*))?$/);
    if (!match) return;
    const requestedName = match[1].toLowerCase();
    const name = bot.aliases.get(requestedName) || requestedName;
    const command = bot.commands.get(name);
    if (!command) return;
    const rawArgs = match[2] || '';
    const args = rawArgs.match(/"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|\S+/g)?.map((arg) => arg.replace(/^("|')|("|')$/g, '')) || [];
    try {
      const remaining = bot.consumeCooldown(command, message.author.id);
      if (remaining) {
        await bot.api.sendContainer(message.laneId, { title: 'Slow down a moment', description: `Try **${prefix}${command.name}** again in ${remaining}s.`, accentColor: 0xfee75c }, { replyToId: message.id });
        return;
      }
      if (args.length < (command.minArgs || 0)) {
        await bot.api.sendContainer(message.laneId, { title: `How to use ${prefix}${command.name}`, description: `${prefix}${command.name} ${command.usage || ''}`.trim(), accentColor: 0xfee75c }, { replyToId: message.id });
        return;
      }
      await command.execute({ bot, client: bot.api, message, args, rawArgs, prefix });
    } catch (error) {
      console.error(`[Command:${command.name}] ${error?.message || 'failed'}`);
      try { await bot.api.sendContainer(message.laneId, errorCard(error), { replyToId: message.id }); }
      catch (replyError) { console.error(`[Command:${command.name}] Could not send error card: ${replyError?.message || 'unknown error'}`); }
    }
  },
};
