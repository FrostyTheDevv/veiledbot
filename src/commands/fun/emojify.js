const faces = ['😀','😎','🤖','✨','🔥','🎉','💜','🌙','🦊','🪄'];
export default { name: 'emojify', category: 'fun', description: 'Add emoji decoration to text.', usage: '<text>', minArgs: 1, cooldown: 3,
  async execute({ client, message, rawArgs }) { const text = Array.from(rawArgs).slice(0, 300).map((char) => /\s/.test(char) ? char : `${char}${faces[Math.floor(Math.random() * faces.length)]}`).join(''); return client.sendContainer(message.laneId, { title: 'Emojified', description: text.slice(0, 3500) }, { replyToId: message.id }); }
};
