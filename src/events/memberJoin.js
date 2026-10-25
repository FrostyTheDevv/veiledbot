export default {
  name: 'MEMBER_JOIN',
  once: false,
  execute(bot, data) {
    console.log('[Event: MEMBER_JOIN] Member joined:', data?.username || data?.user?.username || data);
  },
};
