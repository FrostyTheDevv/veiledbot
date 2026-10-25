function tokenize(source) {
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%^]/g) || [];
  if (tokens.join('') !== source.replace(/\s+/g, '')) throw new Error('Only numbers and + - * / % ^ parentheses are supported.');
  return tokens;
}
export function evaluate(source) {
  const tokens = tokenize(source); let index = 0;
  const primary = () => {
    const token = tokens[index++];
    if (token === '(') { const value = expression(); if (tokens[index++] !== ')') throw new Error('Check your parentheses.'); return value; }
    if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * primary();
    const value = Number(token); if (!Number.isFinite(value)) throw new Error('Expected a number.'); return value;
  };
  const power = () => { const left = primary(); if (tokens[index] === '^') { index++; return left ** power(); } return left; };
  const product = () => { let value = power(); while (['*', '/', '%'].includes(tokens[index])) { const op = tokens[index++], rhs = power(); value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs; } return value; };
  const expression = () => { let value = product(); while (['+', '-'].includes(tokens[index])) { const op = tokens[index++], rhs = product(); value = op === '+' ? value + rhs : value - rhs; } return value; };
  if (!tokens.length || tokens.length > 100) throw new Error('Enter a calculation with up to 100 tokens.');
  const result = expression();
  if (index !== tokens.length || !Number.isFinite(result) || Math.abs(result) > 1e100) throw new Error('That calculation is invalid or too large.');
  return result;
}
export default {
  name: 'calc', category: 'utility', description: 'Evaluate basic arithmetic without executing code.', aliases: ['calculate', 'math'], usage: '<expression>', minArgs: 1, cooldown: 2,
  async execute({ client, message, rawArgs }) {
    try { const result = evaluate(rawArgs); return client.sendContainer(message.laneId, { title: 'Calculator', description: `\`${rawArgs.slice(0, 250)}\` = **${result}**` }, { replyToId: message.id }); }
    catch (error) { return client.sendContainer(message.laneId, { title: 'Could not calculate', description: error.message }, { replyToId: message.id }); }
  },
};
