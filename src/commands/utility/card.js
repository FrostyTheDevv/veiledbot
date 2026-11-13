import { createContainer } from '../../containers.js';
import { resolveMediaUrl, safeText } from '../../commandUtils.js';

export const CARD_COLOR_PRESETS = Object.freeze([
  { label: 'Blurple (#5865F2)', value: '0x5865f2', color: 0x5865f2 },
  { label: 'Emerald (#57F287)', value: '0x57f287', color: 0x57f287 },
  { label: 'Gold (#FEE75C)', value: '0xfee75c', color: 0xfee75c },
  { label: 'Crimson (#ED4245)', value: '0xed4245', color: 0xed4245 },
  { label: 'Amethyst (#9B59B6)', value: '0x9b59b6', color: 0x9b59b6 },
  { label: 'Ocean (#00B0F4)', value: '0x00b0f4', color: 0x00b0f4 },
  { label: 'Rose (#EB459E)', value: '0xeb459e', color: 0xeb459e },
  { label: 'Midnight (#24292F)', value: '0x24292f', color: 0x24292f },
]);

export function createDefaultCardDraft() {
  return {
    title: 'Your Container Title',
    description: 'Customize every part of this Components V2 container using the controls below or subcommands.',
    accentColor: 0x5865f2,
    thumbnail: null,
    images: [],
    sections: [],
    dividers: true,
    spacing: 1,
    footer: 'Built with VeiledBot Container Builder',
    footerDivider: true,
    spoiler: false,
    linkButtons: [],
  };
}

export function getCardDraft(bot, userId) {
  if (!bot.cardDrafts) bot.cardDrafts = new Map();
  const key = String(userId || 'default');
  if (!bot.cardDrafts.has(key)) {
    bot.cardDrafts.set(key, createDefaultCardDraft());
  }
  return bot.cardDrafts.get(key);
}

export function parseCardPipeInput(rawArgs = '') {
  const segments = String(rawArgs || '').split('|').map((part) => part.trim()).filter(Boolean);
  if (!segments.length) return null;

  const draft = {
    title: '',
    description: '',
    accentColor: 0x5865f2,
    thumbnail: null,
    images: [],
    sections: [],
    dividers: true,
    spacing: 1,
    footer: '',
    footerDivider: true,
    spoiler: false,
    linkButtons: [],
  };

  const positional = [];
  for (const segment of segments) {
    const kvMatch = /^(title|desc|description|color|accent|thumb|thumbnail|image|img|media|section|sec|footer|button|btn|link|spoiler|divider|spacing)\s*:\s*([\s\S]+)$/i.exec(segment);
    if (!kvMatch) {
      positional.push(segment);
      continue;
    }
    const key = kvMatch[1].toLowerCase();
    const val = kvMatch[2].trim();
    if (key === 'title') draft.title = safeText(val, 100);
    else if (key === 'desc' || key === 'description') draft.description = safeText(val, 3500);
    else if (key === 'color' || key === 'accent') {
      const hex = val.replace(/^#|^0x/i, '');
      if (/^[0-9a-f]{6}$/i.test(hex)) draft.accentColor = Number.parseInt(hex, 16);
    } else if (key === 'thumb' || key === 'thumbnail') {
      const url = resolveMediaUrl(val);
      if (url) draft.thumbnail = { url };
    } else if (key === 'image' || key === 'img' || key === 'media') {
      const url = resolveMediaUrl(val);
      if (url && draft.images.length < 10) draft.images.push({ url });
    } else if (key === 'section' || key === 'sec') {
      if (draft.sections.length < 4) draft.sections.push({ divider: draft.dividers, spacing: draft.spacing, content: safeText(val, 1500) });
    } else if (key === 'footer') {
      draft.footer = safeText(val, 300);
    } else if (key === 'button' || key === 'btn' || key === 'link') {
      const btnMatch = /^([^,>]+?)(?:,|->|\s+)(https?:\/\/\S+)$/i.exec(val);
      if (btnMatch && draft.linkButtons.length < 5) {
        draft.linkButtons.push({ label: btnMatch[1].trim().slice(0, 80), url: btnMatch[2].trim() });
      }
    } else if (key === 'spoiler') {
      draft.spoiler = ['true', 'on', 'yes', '1'].includes(val.toLowerCase());
    } else if (key === 'divider') {
      draft.dividers = !['false', 'off', 'no', '0'].includes(val.toLowerCase());
    } else if (key === 'spacing') {
      draft.spacing = val === '2' ? 2 : 1;
    }
  }

  if (!draft.title && positional.length > 0) draft.title = safeText(positional.shift(), 100);
  if (!draft.description && positional.length > 0) draft.description = safeText(positional.join(' | '), 3500);
  if (!draft.title) draft.title = 'Your card';
  if (!draft.description && !draft.images.length && !draft.sections.length) {
    draft.description = 'Add text after a `|` to fill the card.';
  }
  return draft;
}

export function buildCardPayload(draft, { includeBuilderControls = false, prefix = '!' } = {}) {
  const sections = draft.sections.map((sec) => ({
    divider: draft.dividers,
    spacing: draft.spacing,
    content: sec.content,
    ...(sec.thumbnail ? { thumbnail: sec.thumbnail } : {}),
  }));

  if (includeBuilderControls) {
    const summaryLines = [
      `**Accent:** \`#${draft.accentColor.toString(16).padStart(6, '0').toUpperCase()}\` · **Dividers:** ${draft.dividers ? 'On' : 'Off'} (spacing ${draft.spacing}) · **Spoiler:** ${draft.spoiler ? 'Yes' : 'No'}`,
      `**Thumbnail:** ${draft.thumbnail ? 'Set' : 'None'} · **Gallery images:** ${draft.images.length} · **Sections:** ${draft.sections.length} · **Link buttons:** ${draft.linkButtons.length}`,
      `**Subcommands:** \`${prefix}card title <text>\` · \`${prefix}card desc <text>\` · \`${prefix}card section <text>\` · \`${prefix}card image <url>\` · \`${prefix}card thumb <url>\` · \`${prefix}card footer <text>\` · \`${prefix}card button <label> | <url>\` · \`${prefix}card color <#hex>\``,
    ];
    if (sections.length < 3) {
      sections.push({ divider: true, spacing: 1, content: summaryLines.join('\n') });
    }
  }

  const actionRows = [];
  if (includeBuilderControls) {
    actionRows.push({
      type: 1,
      components: [{
        type: 3,
        custom_id: 'veiledbot:card:color',
        placeholder: 'Select container accent color',
        options: CARD_COLOR_PRESETS.map((preset) => ({
          label: preset.label,
          value: preset.value,
          default: preset.color === draft.accentColor,
        })),
      }],
    });
    actionRows.push({
      type: 1,
      components: [{
        type: 3,
        custom_id: 'veiledbot:card:option',
        placeholder: 'Container layout & clear options',
        options: [
          { label: `Dividers: ${draft.dividers ? 'Enabled' : 'Disabled'} (Toggle)`, value: 'toggle_dividers' },
          { label: `Divider Spacing: ${draft.spacing} (Toggle 1/2)`, value: 'toggle_spacing' },
          { label: `Footer Divider: ${draft.footerDivider ? 'Enabled' : 'Disabled'} (Toggle)`, value: 'toggle_footer_divider' },
          { label: `Spoiler Container: ${draft.spoiler ? 'Yes' : 'No'} (Toggle)`, value: 'toggle_spoiler' },
          { label: 'Clear Thumbnail', value: 'clear_thumbnail' },
          { label: 'Clear Media Gallery Images', value: 'clear_images' },
          { label: 'Clear Extra Sections', value: 'clear_sections' },
          { label: 'Clear Link Buttons', value: 'clear_buttons' },
          { label: 'Clear Footer', value: 'clear_footer' },
        ],
      }],
    });
    actionRows.push({
      type: 1,
      components: [
        { type: 2, style: 3, label: 'Publish Card', custom_id: 'veiledbot:card:publish' },
        { type: 2, style: 2, label: draft.dividers ? 'Dividers: On' : 'Dividers: Off', custom_id: 'veiledbot:card:divider' },
        { type: 2, style: 2, label: draft.spoiler ? 'Spoiler: On' : 'Spoiler: Off', custom_id: 'veiledbot:card:spoiler' },
        { type: 2, style: 4, label: 'Reset Builder', custom_id: 'veiledbot:card:reset' },
      ],
    });
  }

  return {
    title: draft.title || undefined,
    description: draft.description || undefined,
    thumbnail: draft.thumbnail || undefined,
    images: draft.images,
    sections,
    footer: draft.footer || undefined,
    footerDivider: draft.footerDivider,
    accentColor: draft.accentColor,
    spoiler: draft.spoiler,
    linkButtons: draft.linkButtons,
    actionRows,
  };
}

export function createCardBuilderComponents(bot, userId, { includeBuilderControls = true, prefix = '!' } = {}) {
  const draft = getCardDraft(bot, userId);
  return createContainer(buildCardPayload(draft, { includeBuilderControls, prefix }));
}

export default {
  name: 'card',
  category: 'utility',
  description: 'Full Components V2 container builder (interactive studio + pipe/subcommand builder).',
  aliases: ['container'],
  usage: '[builder | title/desc/section/image/thumb/footer/button/color/publish | <title> | <text> ...]',
  cooldown: 3,
  async execute({ bot = {}, client, message, args = [], rawArgs = '', prefix = '!' }) {
    const trimmed = String(rawArgs || '').trim();
    const userId = message?.author?.id || 'default';

    if (!trimmed || ['builder', 'studio', 'interactive', 'open'].includes(trimmed.toLowerCase())) {
      const draft = getCardDraft(bot, userId);
      return client.sendContainer(message.laneId, buildCardPayload(draft, { includeBuilderControls: true, prefix }), { replyToId: message.id });
    }

    const sub = String(args[0] || '').toLowerCase();
    const rest = trimmed.slice(String(args[0] || '').length).trim();
    const subcommands = new Set(['title', 'desc', 'description', 'color', 'accent', 'thumb', 'thumbnail', 'image', 'img', 'section', 'sec', 'footer', 'button', 'btn', 'spoiler', 'publish', 'send', 'reset']);

    if (subcommands.has(sub) && !trimmed.includes(' | title:')) {
      const draft = getCardDraft(bot, userId);
      if (sub === 'reset') {
        bot.cardDrafts?.set(String(userId), createDefaultCardDraft());
      } else if (sub === 'publish' || sub === 'send') {
        return client.sendContainer(message.laneId, buildCardPayload(draft, { includeBuilderControls: false, prefix }), { replyToId: message.id });
      } else if (sub === 'title') {
        draft.title = safeText(rest, 100);
      } else if (sub === 'desc' || sub === 'description') {
        draft.description = safeText(rest, 3500);
      } else if (sub === 'color' || sub === 'accent') {
        const hex = rest.replace(/^#|^0x/i, '').trim();
        if (!/^[0-9a-f]{6}$/i.test(hex)) {
          return client.sendContainer(message.laneId, { title: 'Invalid accent color', description: 'Provide a 6-digit hex color such as `#5865F2` or `#57F287`.' }, { replyToId: message.id });
        }
        draft.accentColor = Number.parseInt(hex, 16);
      } else if (sub === 'thumb' || sub === 'thumbnail') {
        const url = resolveMediaUrl(rest);
        if (!url) return client.sendContainer(message.laneId, { title: 'Invalid thumbnail URL', description: 'Provide a valid `https://` image URL.' }, { replyToId: message.id });
        draft.thumbnail = { url };
      } else if (sub === 'image' || sub === 'img') {
        const [urlPart, altPart] = rest.split('|').map((s) => s.trim());
        const url = resolveMediaUrl(urlPart);
        if (!url) return client.sendContainer(message.laneId, { title: 'Invalid image URL', description: 'Provide a valid `https://` image URL.' }, { replyToId: message.id });
        if (draft.images.length >= 10) draft.images.shift();
        draft.images.push({ url, ...(altPart ? { description: safeText(altPart, 200) } : {}) });
      } else if (sub === 'section' || sub === 'sec') {
        if (!rest) return client.sendContainer(message.laneId, { title: 'Missing section text', description: `Use \`${prefix}card section <content>\`.` }, { replyToId: message.id });
        if (draft.sections.length >= 4) draft.sections.shift();
        draft.sections.push({ content: safeText(rest, 1500) });
      } else if (sub === 'footer') {
        draft.footer = safeText(rest, 300);
      } else if (sub === 'button' || sub === 'btn') {
        const [labelPart, urlPart] = rest.split('|').map((s) => s.trim());
        const url = resolveMediaUrl(urlPart);
        if (!labelPart || !url) {
          return client.sendContainer(message.laneId, { title: 'Invalid link button', description: `Use \`${prefix}card button <Label> | <https://example.com>\`.` }, { replyToId: message.id });
        }
        if (draft.linkButtons.length >= 5) draft.linkButtons.shift();
        draft.linkButtons.push({ label: labelPart.slice(0, 80), url });
      } else if (sub === 'spoiler') {
        draft.spoiler = ['on', 'true', 'yes', '1'].includes(rest.toLowerCase()) ? true : ['off', 'false', 'no', '0'].includes(rest.toLowerCase()) ? false : !draft.spoiler;
      }

      const updated = getCardDraft(bot, userId);
      return client.sendContainer(message.laneId, buildCardPayload(updated, { includeBuilderControls: true, prefix }), { replyToId: message.id });
    }

    const parsed = parseCardPipeInput(trimmed);
    return client.sendContainer(message.laneId, buildCardPayload(parsed, { includeBuilderControls: false, prefix }), { replyToId: message.id });
  },
};
