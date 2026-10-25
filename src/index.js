import { Bot } from './bot.js';

const bot = new Bot();

bot.start().catch((err) => {
  console.error('[Bot] Fatal error starting bot:', err.message);
  process.exit(1);
});
