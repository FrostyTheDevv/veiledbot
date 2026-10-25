export default {
  name: 'disconnect',
  once: false,
  execute(bot, reason) {
    console.warn(`[Gateway] Disconnected: ${reason}`);
  },
};
