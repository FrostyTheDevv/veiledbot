import { createHelpComponents, parseHelpControl } from '../commands/utility/help.js';

export default {
  name: 'INTERACTION_CREATE',
  async execute(bot, interaction) {
    const customId = interaction?.data?.custom_id;
    const interactionId = interaction?.interaction_id;
    if (!interactionId) return;
    const selection = customId === 'veiledbot:help:category'
      ? { kind: 'category', category: interaction.data.values?.[0] || 'home' }
      : parseHelpControl(customId);
    if (!selection) return;
    const page = selection.kind === 'page' ? selection.page : 0;
    const category = selection.kind === 'home' ? 'home' : selection.category;
    try {
      await bot.api.respondToInteraction(interactionId, {
        type: 'update',
        components: createHelpComponents(bot, category, bot.config.commandPrefix, page),
      });
    } catch (error) {
      console.error(`[Interaction] Help menu update failed: ${error?.message || 'unknown error'}`);
    }
  },
};
