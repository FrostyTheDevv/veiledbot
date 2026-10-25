export default {
  name: 'textstats', category: 'utility', description: 'Count characters, words, lines, and UTF-8 bytes.', aliases: ['wordcount'], usage: '<text>', minArgs: 1, cooldown: 2,
  async execute({ client, message, rawArgs }) {
    const words = rawArgs.trim().split(/\s+/).filter(Boolean);
    return client.sendContainer(message.laneId, { title: 'Text statistics', description: `Characters: **${Array.from(rawArgs).length}**\nWords: **${words.length}**\nLines: **${rawArgs.split(/\r?\n/).length}**\nUTF-8 bytes: **${Buffer.byteLength(rawArgs, 'utf8')}**` }, { replyToId: message.id });
  },
};
