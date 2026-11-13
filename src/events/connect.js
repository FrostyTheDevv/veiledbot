export default {
  name: 'connect',
  once: false,
  execute(bot) {
    if (bot?.reconnectTimer) {
      clearTimeout(bot.reconnectTimer);
      bot.reconnectTimer = null;
    }
    console.log('[Gateway] Connected successfully');
  },
};
