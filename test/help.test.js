import test from 'node:test';
import assert from 'node:assert/strict';
import help, { createHelpComponents, parseHelpControl } from '../src/commands/utility/help.js';
import interactionCreate from '../src/events/interactionCreate.js';

function fakeBot(count = 14) {
  const commands = new Map();
  for (let index = 0; index < count; index += 1) {
    const command = {
      name: `utility-${String(index + 1).padStart(2, '0')}`,
      category: 'utility',
      description: `Utility command ${index + 1}`,
      usage: '<value>',
    };
    commands.set(command.name, command);
  }
  commands.set('roll', { name: 'roll', category: 'fun', description: 'Roll the dice.' });
  return { commands, aliases: new Map([['h', 'help']]), config: { commandPrefix: '!' } };
}

function children(components) { return components[0].components; }
function content(components) { return children(components).filter((item) => item.type === 10).map((item) => item.content).join('\n'); }

test('help opens on a home card that explains category browsing instead of dumping all commands', () => {
  const home = createHelpComponents(fakeBot());
  assert.match(content(home), /VeiledBot Help/);
  assert.match(content(home), /Browse commands by category/);
  assert.match(content(home), /\*\*Utilities\*\* · 14 commands/);
  assert.doesNotMatch(content(home), /Utility command 1/);
  const menu = children(home).find((item) => item.type === 1);
  assert.equal(menu.components[0].custom_id, 'veiledbot:help:category');
  assert.ok(menu.components[0].options.some((option) => option.value === 'utility'));
});

test('a category is paginated with bounded entries and navigation controls', () => {
  const pageOne = createHelpComponents(fakeBot(), 'utility', '!', 0);
  const pageTwo = createHelpComponents(fakeBot(), 'utility', '!', 1);
  const firstText = content(pageOne);
  const secondText = content(pageTwo);
  assert.match(firstText, /Page 1 of 3/);
  assert.match(secondText, /Page 2 of 3/);
  assert.match(firstText, /utility-01/);
  assert.doesNotMatch(firstText, /utility-07/);
  assert.match(secondText, /utility-07/);
  const controls = children(pageOne).find((item) => item.type === 1 && item.components[0]?.type === 2);
  assert.equal(controls.components[0].custom_id, 'veiledbot:help:home');
  assert.equal(controls.components[1].disabled, true);
  assert.equal(controls.components[3].custom_id, 'veiledbot:help:page:utility:1');
});

test('all commands and explicit category requests still use the same paginated view', async () => {
  let sent;
  const bot = fakeBot();
  await help.execute({
    bot, client: { sendMessage: async (_laneId, payload) => { sent = payload; } },
    message: { laneId: 'lane-1', id: 'message-1' }, args: ['all'], prefix: '!',
  });
  assert.match(content(sent.components), /Page 1 of 3/);
  assert.match(content(sent.components), /All commands/);
});

test('help component interactions update home, categories, and pages in place', async () => {
  const bot = fakeBot();
  const calls = [];
  bot.api = { respondToInteraction: async (...args) => calls.push(args) };
  const execute = interactionCreate.execute.bind(null, bot);
  await execute({ interaction_id: 'interaction-home', data: { custom_id: 'veiledbot:help:home' } });
  await execute({ interaction_id: 'interaction-category', data: { custom_id: 'veiledbot:help:category', values: ['fun'] } });
  await execute({ interaction_id: 'interaction-page', data: { custom_id: 'veiledbot:help:page:utility:2' } });
  assert.equal(calls.length, 3);
  assert.match(content(calls[0][1].components), /Browse commands by category/);
  assert.match(content(calls[1][1].components), /VeiledBot · Fun/);
  assert.match(content(calls[1][1].components), /1 command · Page 1 of 1/);
  assert.match(content(calls[2][1].components), /Page 3 of 3/);
});

test('help paging IDs reject malformed or unrelated controls', () => {
  assert.deepEqual(parseHelpControl('veiledbot:help:home'), { kind: 'home' });
  assert.deepEqual(parseHelpControl('veiledbot:help:page:room_news:2'), { kind: 'page', category: 'room_news', page: 2 });
  assert.equal(parseHelpControl('veiledbot:help:page:bad:%ZZ'), null);
  assert.equal(parseHelpControl('other:button'), null);
});

test('home reserves room under the CV2 child limit and dynamic category values stay bounded', () => {
  const bot = fakeBot(1);
  const longCategory = `category with punctuation / ${'x'.repeat(120)} 🦊`;
  for (let index = 0; index < 8; index += 1) {
    const command = { name: `custom-${index}`, category: index === 0 ? longCategory : `extra-${index}`, description: 'Custom category command.' };
    bot.commands.set(command.name, command);
  }
  const home = createHelpComponents(bot);
  assert.ok(children(home).length <= 10);
  assert.match(content(home), /more categories are available in the menu/);
  const menu = children(home).find((item) => item.type === 1)?.components[0];
  const longOption = menu.options.find((option) => option.label.includes('Category With Punctuation'));
  assert.ok(longOption);
  assert.ok(longOption.value.length <= 100);
  assert.ok(longOption.label.length <= 100);
  const pageView = createHelpComponents(bot, longOption.value);
  assert.ok(children(pageView).length <= 10);
  const controls = children(pageView).find((item) => item.type === 1 && item.components[0]?.type === 2);
  assert.ok(controls.components.every((control) => control.custom_id.length <= 100));
  const pageControl = parseHelpControl(controls.components[3].custom_id);
  assert.equal(pageControl.category, longOption.value);
  assert.match(content(createHelpComponents(bot, pageControl.category, '!', pageControl.page)), /Category With Punctuation/);
});
