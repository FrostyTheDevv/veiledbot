export default {
  name: 'color', category: 'utility', description: 'Inspect a hexadecimal color value.', aliases: ['colour'], usage: '<#RRGGBB>', minArgs: 1, cooldown: 2,
  async execute({ client, message, args }) {
    const hex = args[0].replace(/^#/, '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return client.sendContainer(message.laneId, { title: 'Invalid color', description: 'Use a six-digit hex value such as `#5865F2`.' }, { replyToId: message.id });
    const value = Number.parseInt(hex, 16); const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    return client.sendContainer(message.laneId, { title: `#${hex.toUpperCase()}`, description: `RGB: **${rgb.join(', ')}**\nDecimal: **${value}**\nCSS: \`#${hex.toUpperCase()}\``, accentColor: value }, { replyToId: message.id });
  },
};
