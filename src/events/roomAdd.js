export default {
  name: 'BOT_ROOM_ADD',
  once: false,
  execute(bot, data) {
    console.log('[Event: BOT_ROOM_ADD] Bot added to room:', data?.name || data?.id || data);
  },
};
