export default {
  name: 'connect_error',
  once: false,
  execute(bot, error) {
    const message = error?.message || 'Unknown gateway error';
    console.error(`[Gateway] Connection error: ${message}`);

    // Socket.IO v4 does not auto-reconnect when rejected by server middleware
    // (such as when a previous process's shard lease is still expiring).
    const isFatalAuth = /invalid.*token|unauthorized|forbidden|unknown.*intent/i.test(message);
    if (!isFatalAuth && bot?.gateway && !bot.gateway.connected && !bot.gateway.active) {
      const delayMs = /lease|already connected/i.test(message) ? 3000 : 5000;
      console.log(`[Gateway] Retrying gateway connection in ${delayMs / 1000}s...`);
      clearTimeout(bot.reconnectTimer);
      bot.reconnectTimer = setTimeout(() => {
        bot.reconnectTimer = null;
        if (bot.gateway && !bot.gateway.connected) {
          bot.gateway.connect();
        }
      }, delayMs);
    }
  },
};
