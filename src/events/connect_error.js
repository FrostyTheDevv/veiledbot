export default {
  name: 'connect_error',
  once: false,
  execute(bot, error) {
    console.error(`[Gateway] Connection error: ${error.message}`);
  },
};
