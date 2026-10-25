export default {
  name: 'MESSAGE_DELETE',
  once: false,
  execute(bot, data) {
    console.log('[Event: MESSAGE_DELETE] Message deleted:', data?.id || data);
  },
};
