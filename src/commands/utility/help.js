import { createContainer } from '../../containers.js';

const categoryLabels = { all: 'All commands', utility: 'Utilities', fun: 'Fun', rooms: 'Rooms', messages: 'Messages' };

function chunkLines(lines, limit = 3200, maxChunks = 3) {
  const chunks = []; let chunk = '';
  for (const line of lines) {
    const candidate = chunk ? `${chunk}\n\n${line}` : line;
    if (candidate.length > limit && chunk) { chunks.push(chunk); chunk = line; }
    else chunk = candidate;
  }
  if (chunk) chunks.push(chunk);
  return chunks.slice(0, maxChunks);
}

export function createHelpComponents(bot, selected = 'all', prefix = '!') {
  const category = categoryLabels[selected] ? selected : 'all';
  const commands = [...bot.commands.values()].filter((command) => category === 'all' || command.category === category).sort((a, b) => a.name.localeCompare(b.name));
  const lines = commands.map((command) => `**${prefix}${command.name}** — ${command.description || 'No description.'}${command.usage ? `\nUsage: \`${prefix}${command.name} ${command.usage}\`` : ''}`);
  const sections = chunkLines(lines.length ? lines : ['No commands in this category.']).map((content, index) => ({ divider: index > 0, content }));
  if (lines.length > 0 && sections.length === 3 && lines.join('\n\n').length > 9600) sections[2].content += '\n\n-# Additional commands omitted; choose a category to narrow the list.';
  const components = createContainer({ title: 'VeiledBot commands', description: `${categoryLabels[category]} · ${commands.length} commands`, sections, footer: `Use ${prefix}help <command> for details.` });
  components[0].components.push({ type: 1, components: [{ type: 3, custom_id: 'veiledbot:help:category', placeholder: 'Browse command categories', options: Object.entries(categoryLabels).map(([value, label]) => ({ label, value, default: value === category })) }] });
  return components;
}

export default {
  name: 'help', category: 'utility', description: 'Browse commands and command usage.', aliases: ['commands', 'h'], usage: '[category or command]', cooldown: 2,
  async execute({ bot, client, message, args, prefix }) {
    const requested = (args[0] || 'all').toLowerCase();
    const command = bot.commands.get(bot.aliases.get(requested) || requested);
    if (command) {
      const aliases = command.aliases?.length ? `\nAliases: ${command.aliases.map((alias) => `\`${prefix}${alias}\``).join(', ')}` : '';
      return client.sendContainer(message.laneId, { title: `${prefix}${command.name}`, description: command.description || 'No description.', sections: [{ content: `Usage: \`${prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}\`${aliases}` }] }, { replyToId: message.id });
    }
    const category = categoryLabels[requested] ? requested : 'all';
    return client.sendMessage(message.laneId, { components: createHelpComponents(bot, category, prefix), replyToId: message.id });
  },
};
