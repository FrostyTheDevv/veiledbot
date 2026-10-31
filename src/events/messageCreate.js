import { errorCard, safeText } from '../commandUtils.js';

function mentionedUsers(message) {
  const mentions = message?.mentions;
  if (Array.isArray(mentions)) return mentions;
  if (Array.isArray(mentions?.users)) return mentions.users;
  if (mentions?.users && typeof mentions.users === 'object') return Object.values(mentions.users);
  if (mentions && typeof mentions === 'object') return Object.values(mentions);
  return [];
}

export function normalizeMessagePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const raw = (payload.message && typeof payload.message === 'object' && !Array.isArray(payload.message))
    ? payload.message
    : (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data))
      ? (payload.data.message || payload.data)
      : payload;

  const laneId = raw.laneId || raw.channel_id || raw.channelId || payload.laneId || payload.channel_id || payload.channelId;
  const roomId = raw.roomId || raw.guild_id || raw.guildId || payload.roomId || payload.guild_id || payload.guildId || payload.lane?.roomId || raw.lane?.roomId;
  let author = raw.author || raw.user || payload.author || payload.user;
  if (typeof author === 'string') author = { id: author };

  return {
    ...payload,
    ...raw,
    id: raw.id ?? raw.messageId ?? payload.id ?? payload.messageId,
    laneId,
    roomId,
    author,
    content: raw.content ?? payload.content ?? '',
  };
}

export default {
  name: 'MESSAGE_CREATE',
  async execute(bot, rawPayload) {
    const message = normalizeMessagePayload(rawPayload);
    if (!message) return;

    if (message.author?.id && message.author.id === bot.user?.id) {
      return;
    }
    if (message.author?.isBot || message.webhookId) {
      return;
    }

    if (!message.laneId) {
      console.warn('[Gateway:MESSAGE_CREATE] Ignored: payload missing laneId:', rawPayload);
      return;
    }
    if (!message.author?.id) {
      console.warn('[Gateway:MESSAGE_CREATE] Ignored: payload missing author.id:', rawPayload);
      return;
    }

    const content = String(message.content || '').trim();
    if (!content) {
      console.log(`[Gateway:MESSAGE_CREATE] Message received in lane ${message.laneId} from ${message.author?.username || message.author?.id} with empty content. (Note: MESSAGE_CONTENT intent may be required to view message text)`);
      return;
    }

    const configuredPrefix = bot.config.commandPrefix;
    const prefixes = [configuredPrefix, '!'].filter((p, i, a) => p && a.indexOf(p) === i);
    const matchedPrefix = prefixes.find((p) => content.startsWith(p));
    const prefix = matchedPrefix || configuredPrefix;

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

    const mentions = [
      bot.user?.id && `<@${bot.user.id}>`,
      bot.user?.id && `<@!${bot.user.id}>`,
      bot.user?.username && `@${bot.user.username}`,
      bot.user?.displayName && `@${bot.user.displayName}`,
    ].filter(Boolean);
    const matchedMention = mentions.find((pattern) => content.toLowerCase().startsWith(pattern.toLowerCase()));
    const isMentioned = Boolean(matchedMention || mentionedUsers(message).some((item) => (item?.id || item?.userId || item) === bot.user?.id));

    let input = null;
    let usedPrefix = prefix;
    if (matchedMention) {
      input = content.slice(matchedMention.length).trim() || 'help';
      usedPrefix = matchedMention;
    } else if (matchedPrefix) {
      input = content.slice(matchedPrefix.length).trim();
      usedPrefix = matchedPrefix;
    } else if (isMentioned) {
      input = 'help';
    } else {
      return;
    }

    const match = input.match(/^(\S+)(?:\s+([\s\S]*))?$/);
    if (!match) return;
    const requestedName = match[1].toLowerCase();
    const name = bot.aliases.get(requestedName) || requestedName;
    const command = bot.commands.get(name);
    if (!command) {
      console.log(`[Command] Unknown command "${requestedName}" requested by ${message.author.username || message.author.id} in lane ${message.laneId} (prefix: "${usedPrefix}")`);
      return;
    }

    const rawArgs = match[2] || '';
    const args = rawArgs.match(/"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|\S+/g)?.map((arg) => arg.replace(/^("|')|("|')$/g, '')) || [];

    console.log(`[Command] Executing "${command.name}" for ${message.author.username || message.author.id} in lane ${message.laneId} [${args.join(', ')}]`);

    try {
      const remaining = bot.consumeCooldown(command, message.author.id);
      if (remaining) {
        console.log(`[Command:${command.name}] Cooldown active: ${remaining}s remaining`);
        await bot.api.sendContainer(message.laneId, { title: 'Slow down a moment', description: `Try **${usedPrefix}${command.name}** again in ${remaining}s.`, accentColor: 0xfee75c }, { replyToId: message.id });
        return;
      }
      if (args.length < (command.minArgs || 0)) {
        console.log(`[Command:${command.name}] Missing args (provided ${args.length}, minimum ${command.minArgs})`);
        await bot.api.sendContainer(message.laneId, { title: `How to use ${usedPrefix}${command.name}`, description: `${usedPrefix}${command.name} ${command.usage || ''}`.trim(), accentColor: 0xfee75c }, { replyToId: message.id });
        return;
      }
      await command.execute({ bot, client: bot.api, message, args, rawArgs, prefix: usedPrefix });
      console.log(`[Command:${command.name}] Finished successfully`);
    } catch (error) {
      console.error(`[Command:${command.name}] Failed: ${error?.message || 'failed'}`);
      try { await bot.api.sendContainer(message.laneId, errorCard(error), { replyToId: message.id }); }
      catch (replyError) { console.error(`[Command:${command.name}] Could not send error card: ${replyError?.message || 'unknown error'}`); }
    }
  },
};
