import { valueArray, safeText } from '../../commandUtils.js';
export default {
  name: 'recent', category: 'messages', description: 'Show a short preview of recent messages in this lane.', aliases: ['recentmessages'], cooldown: 8,
  async execute({ client, message }) {
    const data = await client.getMessages(message.laneId, 'limit=5'); const messages = valueArray(data, 'messages').filter((item) => !item.isDeleted).slice(0, 5);
    const lines = messages.map((item) => {
      const author = item.author || item.User || {};
      const preview = item.content?.trim() || (item.attachments?.length || item.Attachment?.length ? '[attachment]' : '[non-text message]');
      return `**${safeText(author.displayName || author.username || 'Member', 64)}**\n${safeText(preview, 220)}`;
    });
    return client.sendContainer(message.laneId, { title: 'Recent messages', description: lines.join('\n\n') || 'No recent messages were returned.', footer: 'Only messages returned by the API are shown.' }, { replyToId: message.id });
  },
};
