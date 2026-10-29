import { createHash } from 'node:crypto';
import { createContainer } from '../../containers.js';

const knownCategoryLabels = { utility: 'Utilities', fun: 'Fun', rooms: 'Rooms', messages: 'Messages' };
const HELP_PAGE_SIZE = 6;
const MAX_DESCRIPTION_LENGTH = 220;
const MAX_HOME_CATEGORY_SUMMARIES = 4;

function humanizeCategory(value = '') {
  return knownCategoryLabels[value] || value.split(/[-_\s]+/).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' ') || 'Other';
}

function getCategories(bot) {
  const keys = new Set(Object.keys(knownCategoryLabels));
  for (const command of bot.commands.values()) if (typeof command.category === 'string' && command.category.trim()) keys.add(command.category.toLowerCase());
  return [...keys].sort((left, right) => humanizeCategory(left).localeCompare(humanizeCategory(right)));
}

function categoryValue(category) {
  if (/^[a-z0-9_-]{1,80}$/i.test(category)) return category;
  return `x${createHash('sha256').update(category).digest('hex').slice(0, 32)}`;
}

function safeCategory(value, categories) {
  return categories.find((category) => category === value || categoryValue(category) === value) || 'all';
}

function selectedMenu(category, categories) {
  const entries = [
    { value: 'home', label: 'Help home' },
    { value: 'all', label: 'All commands' },
    ...categories.map((value) => ({ value: categoryValue(value), label: humanizeCategory(value).slice(0, 100) })),
  ];
  return {
    type: 1,
    components: [{
      type: 3,
      custom_id: 'veiledbot:help:category',
      placeholder: 'Choose a command category',
      options: entries.slice(0, 25).map(({ value, label }) => ({ label, value, default: category === value })),
    }],
  };
}

function pageControls(category, page, pageCount) {
  const categoryId = categoryValue(category);
  return {
    type: 1,
    components: [
      { type: 2, style: 2, label: 'Home', custom_id: 'veiledbot:help:home' },
      { type: 2, style: 2, label: 'Previous', custom_id: `veiledbot:help:page:${categoryId}:${Math.max(0, page - 1)}`, disabled: page <= 0 },
      { type: 2, style: 2, label: `Page ${page + 1}/${pageCount}`, custom_id: `veiledbot:help:page:${categoryId}:${page}`, disabled: true },
      { type: 2, style: 2, label: 'Next', custom_id: `veiledbot:help:page:${categoryId}:${Math.min(pageCount - 1, page + 1)}`, disabled: page >= pageCount - 1 },
    ],
  };
}

function commandLine(command, prefix) {
  const description = String(command.description || 'No description.').replace(/\s+/g, ' ').slice(0, MAX_DESCRIPTION_LENGTH);
  const usage = command.usage ? `\nUsage: \`${prefix}${command.name} ${String(command.usage).slice(0, 100)}\`` : '';
  return `**${prefix}${command.name}** — ${description}${usage}`;
}

function homeComponents(bot, prefix, categories) {
  const visibleCategories = categories.slice(0, MAX_HOME_CATEGORY_SUMMARIES);
  const sections = visibleCategories.map((category) => {
    const count = [...bot.commands.values()].filter((command) => command.category?.toLowerCase() === category).length;
    return { content: `**${humanizeCategory(category)}** · ${count} ${count === 1 ? 'command' : 'commands'}` };
  });
  if (categories.length > visibleCategories.length) sections.push({ content: `+ ${categories.length - visibleCategories.length} more categories are available in the menu.` });
  return createContainer({
    title: 'VeiledBot Help',
    description: 'Browse commands by category. Pick a category below, or select All commands to page through everything.',
    sections: sections.length ? sections : [{ content: 'No commands are available yet.' }],
    footer: `Use ${prefix}help <command> to see a command’s usage.`,
  }).map((root) => ({
    ...root,
    components: [...root.components, selectedMenu('home', categories)],
  }));
}

export function createHelpComponents(bot, selected = 'home', prefix = '!', requestedPage = 0) {
  const categories = getCategories(bot);
  const requested = String(selected).toLowerCase();
  const category = requested === 'home' ? 'home' : safeCategory(requested, categories);
  if (category === 'home') return homeComponents(bot, prefix, categories);

  const commands = [...bot.commands.values()]
    .filter((command) => category === 'all' || command.category?.toLowerCase() === category)
    .sort((left, right) => left.name.localeCompare(right.name));
  const pageCount = Math.max(1, Math.ceil(commands.length / HELP_PAGE_SIZE));
  const page = Math.min(Math.max(0, Number.isInteger(requestedPage) ? requestedPage : 0), pageCount - 1);
  const pageCommands = commands.slice(page * HELP_PAGE_SIZE, (page + 1) * HELP_PAGE_SIZE);
  const title = category === 'all' ? 'All commands' : humanizeCategory(category);
  const description = commands.length
    ? `${commands.length} ${commands.length === 1 ? 'command' : 'commands'} · Page ${page + 1} of ${pageCount}`
    : 'There are no commands in this category yet.';
  const section = pageCommands.length ? pageCommands.map((command) => commandLine(command, prefix)).join('\n\n') : 'Choose a category from the menu or return to Help home.';
  const components = createContainer({
    title: `VeiledBot · ${title}`,
    description,
    sections: [{ content: section }],
    footer: `Use ${prefix}help <command> for details.`,
  });
  components[0].components.push(selectedMenu(category, categories));
  components[0].components.push(pageControls(category, page, pageCount));
  return components;
}

export function parseHelpControl(customId) {
  if (customId === 'veiledbot:help:home') return { kind: 'home' };
  const pageMatch = /^veiledbot:help:page:([a-z0-9_-]{1,80}):(\d{1,8})$/i.exec(customId || '');
  if (pageMatch) {
    return { kind: 'page', category: pageMatch[1], page: Number(pageMatch[2]) };
  }
  return null;
}

export default {
  name: 'help', category: 'utility', description: 'Browse commands and command usage.', aliases: ['commands', 'h'], usage: '[category or command]', cooldown: 2,
  async execute({ bot, client, message, args, prefix }) {
    const requested = (args[0] || 'home').toLowerCase();
    const command = bot.commands.get(bot.aliases.get(requested) || requested);
    if (command) {
      const aliases = command.aliases?.length ? `\nAliases: ${command.aliases.map((alias) => `\`${prefix}${alias}\``).join(', ')}` : '';
      return client.sendContainer(message.laneId, { title: `${prefix}${command.name}`, description: command.description || 'No description.', sections: [{ content: `Usage: \`${prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}\`${aliases}` }] }, { replyToId: message.id });
    }
    const categories = getCategories(bot);
    const category = requested === 'home' ? 'home' : safeCategory(requested, categories);
    return client.sendMessage(message.laneId, { components: createHelpComponents(bot, category, prefix), replyToId: message.id });
  },
};
