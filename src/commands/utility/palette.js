import { randomInt } from 'node:crypto';

export const COLOR_THEMES = Object.freeze({
  ocean: { description: 'Deep blues and aqua tones.', colors: ['#006994', '#0099CC', '#4FC3F7', '#B3E5FC', '#E0F7FA'] },
  sunset: { description: 'Warm oranges and yellows.', colors: ['#FF6B35', '#FF8C42', '#FFA552', '#FFBE5C', '#FFD66E'] },
  forest: { description: 'A range of natural greens.', colors: ['#1B4D3E', '#2D6A4F', '#40916C', '#52B788', '#74C69D'] },
  pastel: { description: 'Soft pastel colors.', colors: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF'] },
  neon: { description: 'Bright, high-contrast colors.', colors: ['#FF006E', '#FB5607', '#FFBE0B', '#8338EC', '#3A86FF'] },
  monochrome: { description: 'Black, gray, and white.', colors: ['#000000', '#3F3F3F', '#7F7F7F', '#BFBFBF', '#FFFFFF'] },
  warm: { description: 'Reds, oranges, and warm neutrals.', colors: ['#D62828', '#F77F00', '#FCBF49', '#EAE2B7', '#FFCAB1'] },
  cool: { description: 'Blues and cyans.', colors: ['#03045E', '#023E8A', '#0077B6', '#0096C7', '#00B4D8'] },
  earth: { description: 'Browns, tans, and warm neutrals.', colors: ['#6C4C3D', '#8B6F47', '#A68A64', '#C7B299', '#E5DCC5'] },
  candy: { description: 'Bright pinks and soft reds.', colors: ['#FF69B4', '#FF1493', '#FF91A4', '#FFB6C1', '#FFC0CB'] },
});

export function randomPalette(randomColor = () => randomInt(0, 0x1000000)) {
  return Array.from({ length: 5 }, () => `#${randomColor().toString(16).padStart(6, '0').toUpperCase()}`);
}

export function colorDetails(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    hex,
    rgb: [(value >> 16) & 255, (value >> 8) & 255, value & 255],
    decimal: value,
  };
}

export default {
  name: 'palette', category: 'utility', description: 'Show a random or themed five-color palette.', aliases: ['colors', 'hexpalette'], usage: '[random | theme]', cooldown: 3,
  async execute({ client, message, args }) {
    const themeName = String(args[0] || 'random').toLowerCase();
    const theme = COLOR_THEMES[themeName];
    if (themeName !== 'random' && !theme) {
      return client.sendContainer(message.laneId, {
        title: 'Palette not found',
        description: `Choose **random** or one of these themes: ${Object.keys(COLOR_THEMES).join(', ')}.`,
      }, { replyToId: message.id });
    }

    const colors = (theme?.colors || randomPalette()).map(colorDetails);
    return client.sendContainer(message.laneId, {
      title: theme ? `${themeName[0].toUpperCase()}${themeName.slice(1)} palette` : 'Random palette',
      description: theme?.description || 'Five colors picked at random.',
      sections: colors.map(({ hex, rgb, decimal }) => ({ content: `**${hex}**\nRGB: ${rgb.join(', ')} · Decimal: ${decimal}` })),
      accentColor: Number.parseInt(colors[0].hex.slice(1), 16),
    }, { replyToId: message.id });
  },
};
