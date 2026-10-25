import { safeText, valueArray } from '../../commandUtils.js';
export default {
  name: 'pins', category: 'messages', description: 'List pinned messages in the current lane.', cooldown: 8,
  async execute({ client, message }) {
    const data = await client.getPins(message.laneId);
    const pins = Array.isArray(data) ? data : valueArray(data, 'messages').length ? valueArray(data, 'messages') : valueArray(data, 'pins');
    const lines = pins.slice(0, 15).map((entry, index) => {
      const item = entry.Message || entry.message || entry;
      const author = item.author || item.User || {};
      const excerpt = item.content?.trim() || (item.Attachment?.length || item.attachments?.length ? '[attachment]' : '[container or non-text message]');
      return `${index + 1}. **${safeText(author.displayName || author.username || 'Member', 50)}** — ${safeText(excerpt, 180)}`;
    });
    return client.sendContainer(message.laneId, { title: `Pinned messages (${pins.length})`, description: lines.join('\n') || 'No pinned messages were returned.', footer: pins.length > 15 ? 'Showing the first 15.' : undefined }, { replyToId: message.id });
  },
};
