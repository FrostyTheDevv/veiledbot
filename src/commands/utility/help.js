import { createContainer } from '../../containers.js';

const categoryLabels = { all: 'All commands', utility: 'Utilities', fun: 'Fun', rooms: 'Rooms', messages: 'Messages' };

export function createHelpComponents(bot, selected = 'all', prefix = '!') {
  const category = categoryLabels[selected] ? selected : 'all';
  const commands = [...bot.commands.values()]
    .filter((command) => category === 'all' || (command.category || 'utility') === category)
    .sort((a, b) => a.name.localeCompare(b.name));
  const lines = commands.slice(0, 24).map((command) => `**${prefix}${command.name}** — ${command.description || 'No description provided.'}${command.usage ? `\nUsage: \`${prefix}${command.name} ${command.usage}\`` : ''}`);
  const components = createContainer({
    title: 'VeiledBot commands',
    description: `${categoryLabels[category]} · ${commands.length} commands`,
    sections: [{ divider: true, content: lines.join('\n\n') || 'No commands in this category.' }],
    footer: `Use ${prefix}help <command> for command details.`,
  });
  components[0].components.push({
    type: 1,
    components: [{
      type: 3,
      custom_id: 'veiledbot:help:category',
      placeholder: 'Browse command categories',
      options: Object.entries(categoryLabels).map(([value, label]) => ({ label, value, default: value === category })),
    }],
  });
  return components;
}

export default {
  name: 'help', category: 'utility', description: 'Browse commands by category.', aliases: ['commands', 'h'], usage: '[category or command]', cooldown: 2,
  async execute({ bot, client, message, args, prefix }) {
    const requested = (args[0] || 'all').toLowerCase();
    const command = bot.commands.get(bot.aliases.get(requested) || requested);
    if (command) {
      const aliases = command.aliases?.length ? `\nAliases: ${command.aliases.map((alias) => `\`${prefix}${alias}\``).join(', ')}` : '';
      return client.sendContainer(message.laneId, { title: `${prefix}${command.name}`, description: command.description || 'No description provided.', sections: [{ content: `Usage: \`${prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}\`${aliases}` }] }, { replyToId: message.id });
    }
    const category = categoryLabels[requested] ? requested : 'all';
    return client.sendMessage(message.laneId, { components: createHelpComponents(bot, category, prefix), replyToId: message.id });
  },
};