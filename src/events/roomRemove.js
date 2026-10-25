export default {
  name: 'BOT_ROOM_REMOVE',
  once: false,
  execute(bot, data) {
    console.log('[Event: BOT_ROOM_REMOVE] Bot removed from room:', data?.id || data);
  },
};
