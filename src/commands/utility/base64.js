export default {
  name: 'base64', category: 'utility', description: 'Encode or decode UTF-8 text with Base64.', usage: '<encode|decode> <text>', minArgs: 2, cooldown: 3,
  async execute({ client, message, args, rawArgs }) {
    const mode = args[0].toLowerCase(); const text = rawArgs.slice(args[0].length).trim();
    if (!text || !['encode', 'decode'].includes(mode)) return client.sendContainer(message.laneId, { title: 'Usage', description: 'Use `!base64 encode text` or `!base64 decode base64-text`.' }, { replyToId: message.id });
    if (mode === 'decode' && (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 !== 0)) return client.sendContainer(message.laneId, { title: 'Invalid Base64', description: 'Provide standard padded Base64 text.' }, { replyToId: message.id });
    const result = mode === 'encode' ? Buffer.from(text, 'utf8').toString('base64') : Buffer.from(text, 'base64').toString('utf8');
    return client.sendContainer(message.laneId, { title: `Base64 ${mode}`, description: `\`\`\`\n${result.slice(0, 3500)}\n\`\`\`` }, { replyToId: message.id });
  },
};
