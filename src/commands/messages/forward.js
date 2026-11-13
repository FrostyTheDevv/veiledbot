import { safeText } from '../../commandUtils.js';

export default {
  name: 'forward',
  aliases: ['fwd'],
  category: 'messages',
  description: 'Forward the message you replied to with its native rich content preserved.',
  usage: '[optional comment]',
  async execute({ client, message, rawArgs = '' }) {
    const sourceId = message.replyToId || message.referencedMessage?.id || message.reference?.messageId;
    if (!sourceId) {
      return client.sendContainer(message.laneId, {
        title: 'Reply to a message first',
        description: 'Reply to the message you want to forward, then run `!forward` or `!forward <comment>`.',
      }, { replyToId: message.id });
    }
    const comment = String(rawArgs || '').trim();
    await client.forwardMessage(message.laneId, sourceId, {
      kind: message.replyToKind === 'dm' || message.reference?.kind === 'dm' ? 'dm' : 'room',
      ...(comment ? { content: safeText(comment, 4000) } : {}),
      replyToId: message.id,
    });
    return null;
  },
};
