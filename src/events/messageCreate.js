import { errorCard } from '../commandUtils.js';

export default {
  name: 'MESSAGE_CREATE',
  async execute(bot, message) {
    if (!message?.laneId || !message.author?.id || message.author.isBot || message.webhookId) return;
    if (message.author.id === bot.user?.id) return;
    const content = String(message.content || '').trim();
    if (!content) return;

    const prefix = bot.config.commandPrefix;
    const mentions = [bot.user?.id && `<@${bot.user.id}>`, bot.user?.id && `<@!${bot.user.id}>`, bot.user?.username && `@${bot.user.username}`, bot.user?.displayName && `@${bot.user.displayName}`].filter(Boolean);
    const matchedMention = mentions.find((pattern) => content.toLowerCase().startsWith(pattern.toLowerCase()));
    const isMentioned = matchedMention || message.mentions?.some((item) => (item?.id || item) === bot.user?.id);
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
    const userId = message.author.id;

    try {
      const remaining = bot.consumeCooldown(command, userId);
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
      try {
        await bot.api.sendContainer(message.laneId, errorCard(error), { replyToId: message.id });
      } catch (replyError) {
        console.error(`[Command:${command.name}] Could not send error card: ${replyError?.message || 'unknown error'}`);
      }
    }
  },
};
