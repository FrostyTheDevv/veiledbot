import { createContainer } from '../../containers.js';
import { formatDate, safeText, valueArray } from '../../commandUtils.js';

const HISTORY_PAGE_SIZE = 5;

function summarizeMessageItem(item, index) {
  const author = item.author || item.User || item.user || {};
  const authorName = safeText(author.displayName || author.username || author.name || 'Unknown User', 60);
  const botTag = author.isBot ? ' `[BOT]`' : '';
  const created = item.createdAt ? formatDate(item.createdAt) : 'Recent';
  const idText = item.id ? `\`${safeText(item.id, 40)}\`` : '`unknown`';

  let body = String(item.content || '').trim();
  if (body.startsWith('[POLL_DATA]')) {
    body = '📊 *[Native Poll]*';
  } else if (!body) {
    const parts = [];
    if (Array.isArray(item.components) && item.components.length) parts.push('🧩 *[Components V2 Container]*');
    const attachments = item.attachments || item.Attachment || [];
    if (Array.isArray(attachments) && attachments.length) parts.push(`📎 *[${attachments.length} attachment${attachments.length === 1 ? '' : 's'}]*`);
    if (Array.isArray(item.embeds) && item.embeds.length) parts.push('🗂️ *[Embed]*');
    body = parts.join(' · ') || '*[Empty or system message]*';
  } else {
    body = safeText(body.replace(/\s+/g, ' '), 240);
  }

  const replyBadge = item.replyToId ? ` · ↩️ \`${safeText(item.replyToId, 32)}\`` : '';
  return `**#${index + 1} · ${authorName}**${botTag} (${created})\n${body}\n-# ID: ${idText}${replyBadge}`;
}

export function buildHistoryCard({ laneId, messages = [], requestedPage = 0 } = {}) {
  const active = messages.filter((item) => !item?.isDeleted);
  const pageCount = Math.max(1, Math.ceil(active.length / HISTORY_PAGE_SIZE));
  const page = Math.min(Math.max(0, Number.isInteger(requestedPage) ? requestedPage : 0), pageCount - 1);
  const start = page * HISTORY_PAGE_SIZE;
  const pageItems = active.slice(start, start + HISTORY_PAGE_SIZE);

  const sections = pageItems.length
    ? pageItems.map((item, idx) => ({
        divider: true,
        content: summarizeMessageItem(item, start + idx),
      }))
    : [{ divider: true, content: 'No messages were returned for this lane.' }];

  const safeLaneId = String(laneId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || 'lane';
  const actionRows = [{
    type: 1,
    components: [
      {
        type: 2,
        style: 2,
        label: '« First',
        custom_id: `veiledbot:history:first:${safeLaneId}:0`,
        disabled: page <= 0,
      },
      {
        type: 2,
        style: 2,
        label: '‹ Previous',
        custom_id: `veiledbot:history:prev:${safeLaneId}:${Math.max(0, page - 1)}`,
        disabled: page <= 0,
      },
      {
        type: 2,
        style: 2,
        label: `Page ${page + 1}/${pageCount}`,
        custom_id: `veiledbot:history:stat:${safeLaneId}:${page}`,
        disabled: true,
      },
      {
        type: 2,
        style: 2,
        label: 'Next ›',
        custom_id: `veiledbot:history:next:${safeLaneId}:${Math.min(pageCount - 1, page + 1)}`,
        disabled: page >= pageCount - 1,
      },
      {
        type: 2,
        style: 2,
        label: 'Last »',
        custom_id: `veiledbot:history:last:${safeLaneId}:${pageCount - 1}`,
        disabled: page >= pageCount - 1,
      },
    ],
  }];

  return {
    title: 'Lane Message History',
    description: `Showing **${active.length}** recent message${active.length === 1 ? '' : 's'} in this lane · **Page ${page + 1} of ${pageCount}**`,
    sections,
    footer: 'Use the pagination controls below to browse recent lane history.',
    actionRows,
  };
}

export function createHistoryComponents(options = {}) {
  return createContainer(buildHistoryCard(options));
}

export function parseHistoryControl(customId) {
  const match = /^veiledbot:history:(first|prev|next|last):([a-zA-Z0-9_-]{1,60}):(\d{1,6})$/i.exec(customId || '');
  if (!match) return null;
  return { laneId: match[2], page: Number(match[3]) };
}

export default {
  name: 'history',
  category: 'messages',
  description: 'Browse paginated recent message history in the current lane.',
  aliases: ['messagecount'],
  usage: '[page number]',
  cooldown: 5,
  async execute({ client, message, args = [] }) {
    const requestedPage = args[0] && /^\d+$/.test(String(args[0])) ? Math.max(0, Number(args[0]) - 1) : 0;
    const raw = await client.getMessages(message.laneId);
    const messages = valueArray(raw, 'messages');
    const card = buildHistoryCard({ laneId: message.laneId, messages, requestedPage });
    return client.sendContainer(message.laneId, card, { replyToId: message.id });
  },
};
