export default {
  name: 'MESSAGE_UPDATE',
  once: false,
  execute(bot, data) {
    console.log('[Event: MESSAGE_UPDATE] Message updated:', data?.id || data);
  },
};
