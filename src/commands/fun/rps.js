import { randomInt } from 'node:crypto';
import { safeText } from '../../commandUtils.js';

const CHOICES = ['rock', 'paper', 'scissors'];

export function playRound(playerChoice, randomChoiceIndex = randomInt(CHOICES.length)) {
  const player = String(playerChoice || '').toLowerCase();
  if (!CHOICES.includes(player)) return null;
  const opponent = CHOICES[randomChoiceIndex];
  if (!opponent) throw new RangeError('Random choice index is outside the valid range.');
  const outcome = player === opponent ? 'tie'
    : (player === 'rock' && opponent === 'scissors') || (player === 'paper' && opponent === 'rock') || (player === 'scissors' && opponent === 'paper') ? 'win' : 'loss';
  return { player, opponent, outcome };
}

export default {
  name: 'rps', category: 'fun', description: 'Play rock-paper-scissors against the bot.', aliases: ['rockpaperscissors'], usage: '<rock | paper | scissors>', minArgs: 1, cooldown: 2,
  async execute({ client, message, args }) {
    const round = playRound(args[0]);
    if (!round) return client.sendContainer(message.laneId, {
      title: 'Rock-paper-scissors',
      description: `Choose **rock**, **paper**, or **scissors**. Example: \`${safeText('!rps rock', 40)}\`.`,
    }, { replyToId: message.id });

    const result = round.outcome === 'tie' ? 'It is a tie.' : round.outcome === 'win' ? 'You win.' : 'The bot wins.';
    return client.sendContainer(message.laneId, {
      title: 'Rock-paper-scissors',
      sections: [
        { content: `**You:** ${round.player}` },
        { content: `**Bot:** ${round.opponent}` },
      ],
      description: result,
      accentColor: round.outcome === 'win' ? 0x57f287 : round.outcome === 'loss' ? 0xed4245 : 0xfee75c,
    }, { replyToId: message.id });
  },
};
