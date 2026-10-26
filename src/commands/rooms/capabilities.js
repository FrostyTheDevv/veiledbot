import { safeText } from '../../commandUtils.js';

const labels = Object.freeze({
  sendMessages: 'Send messages', sendMessagesInThreads: 'Send messages in threads', readMessageHistory: 'Read message history',
  attachFiles: 'Attach files', embedLinks: 'Embed links', addReactions: 'Add reactions', manageMessages: 'Manage messages',
  manageChannels: 'Manage lanes', connect: 'Connect to voice', speak: 'Speak', stream: 'Stream', sendPolls: 'Create polls',
  sendVoiceMessages: 'Send voice messages', mentionEveryone: 'Mention everyone',
});

export default {
  name: 'capabilities', category: 'rooms', description: 'Show permissions and lane limits for the current lane.', cooldown: 5,
  async execute({ client, message }) {
    const result = await client.getLaneCapabilities(message.laneId);
    const capabilities = result?.capabilities || {};
    const enabled = Object.entries(labels).filter(([key]) => capabilities[key] === true).map(([, label]) => `✓ ${label}`);
    const disabled = Object.entries(labels).filter(([key]) => capabilities[key] === false).map(([, label]) => `× ${label}`);
    const rows = [...enabled, ...disabled];
    const description = rows.length ? rows.join('\n') : 'No capability details were returned for this lane.';
    return client.sendContainer(message.laneId, {
      title: `Lane permissions · ${safeText(message.laneId, 80)}`,
      description: `${description}${result?.slowmode ? `\n\nSlowmode: ${result.slowmode}s` : ''}${result?.characterLimit ? `\nCharacter limit: ${result.characterLimit}` : ''}`,
    }, { replyToId: message.id });
  },
};
