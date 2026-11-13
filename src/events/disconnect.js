export default {
  name: 'disconnect',
  once: false,
  execute(bot, reason) {
    console.warn(`[Gateway] Disconnected: ${reason}`);
    if (reason === 'io server disconnect' && bot?.gateway && !bot.gateway.active) {
      clearTimeout(bot.reconnectTimer);
      bot.reconnectTimer = setTimeout(() => {
        bot.reconnectTimer = null;
        if (bot.gateway && !bot.gateway.connected) {
          bot.gateway.connect();
        }
      }, 3000);
    }
  },
};
