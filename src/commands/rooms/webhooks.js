import { safeText, valueArray } from '../../commandUtils.js';

const idPattern = /^[a-zA-Z0-9_-]{3,100}$/;

export default {
  name: 'webhooks', category: 'rooms', description: 'List, rename, or delete room webhooks.', usage: '[list | rename <webhook ID> <name> | delete <webhook ID> confirm]', cooldown: 8,
  async execute({ client, message, args }) {
    const action = String(args[0] || 'list').toLowerCase();
    if (action === 'list') {
      const result = await client.getLaneWebhooks(message.laneId);
      const rows = valueArray(result, 'webhooks').slice(0, 15);
      const description = rows.length ? rows.map((webhook) => `• **${safeText(webhook.name, 80)}** · ${safeText(webhook.id, 100)}`).join('\n') : 'No webhooks were returned for this lane.';
      return client.sendContainer(message.laneId, { title: 'Lane webhooks', description }, { replyToId: message.id });
    }
    if (action === 'rename') {
      const webhookId = String(args[1] || '').trim();
      const name = args.slice(2).join(' ').trim();
      if (!idPattern.test(webhookId) || !name || name.length > 80) return usage(client, message);
      await client.updateWebhook(webhookId, { name });
      return client.sendContainer(message.laneId, { title: 'Webhook renamed', description: `Webhook **${safeText(webhookId, 100)}** is now named **${safeText(name, 80)}**.` }, { replyToId: message.id });
    }
    if (action === 'delete') {
      const webhookId = String(args[1] || '').trim();
      if (!idPattern.test(webhookId) || String(args[2] || '').toLowerCase() !== 'confirm') return usage(client, message);
      await client.deleteWebhook(webhookId);
      return client.sendContainer(message.laneId, { title: 'Webhook deleted', description: `Deleted webhook **${safeText(webhookId, 100)}**.` }, { replyToId: message.id });
    }
    return usage(client, message);
  },
};

function usage(client, message) {
  return client.sendContainer(message.laneId, { title: 'Webhook command', description: 'Use `!webhooks list`, `!webhooks rename <webhook ID> <name>`, or `!webhooks delete <webhook ID> confirm`. Webhook creation and token rotation return a secret URL; use the trusted settings flow or SDK code and never post that URL in a room.' }, { replyToId: message.id });
}
