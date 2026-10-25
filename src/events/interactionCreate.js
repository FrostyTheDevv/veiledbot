import { createHelpComponents } from '../commands/utility/help.js';

export default {
  name: 'INTERACTION_CREATE',
  async execute(bot, interaction) {
    const customId = interaction?.data?.custom_id;
    const interactionId = interaction?.interaction_id;
    if (!interactionId || customId !== 'veiledbot:help:category') return;
    const category = interaction.data.values?.[0] || 'all';
    try {
      await bot.api.respondToInteraction(interactionId, {
        type: 'update',
        components: createHelpComponents(bot, category, bot.config.commandPrefix),
      });
    } catch (error) {
      console.error(`[Interaction] Help menu update failed: ${error?.message || 'unknown error'}`);
    }
  },
};