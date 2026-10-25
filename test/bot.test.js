import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer, isValidContainerPayload } from '../src/containers.js';
import { VeiledClient } from '../src/api.js';
import { evaluate } from '../src/commands/utility/calc.js';
import { Bot } from '../src/bot.js';

test('container builder creates a Components V2 root without legacy content or embeds', () => {
  const payload = createContainer({ title: 'Hello', description: 'A card', sections: [{ divider: true, content: 'Details' }] });
  assert.equal(isValidContainerPayload(payload), true);
  assert.equal(payload[0].type, 17);
  assert.equal('content' in payload[0], false);
  assert.equal('embeds' in payload[0], false);
  assert.ok(payload[0].components.some((part) => part.type === 10));
});

test('container builder validates link buttons and component bounds', () => {
  assert.throws(() => createContainer({ title: 'Link', linkButtons: [{ label: 'Bad', url: 'javascript:alert(1)' }] }), /HTTP or HTTPS/);
  assert.throws(() => createContainer({ title: 'x'.repeat(4001) }), /4000/);
  const payload = createContainer({ title: 'x', linkButtons: [{ label: 'Website', url: 'https://veiled.lol' }] });
  assert.equal(payload[0].components.at(-1).type, 1);
});

test('API client scopes requests to configured base and sends one Bot auth prefix', async () => {
  let captured;
  const client = new VeiledClient('Bot sample-token', 'https://api.example.test/api/v1', async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ user: { id: 'bot' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await client.getMe();
  assert.equal(captured.options.headers.get('Authorization'), 'Bot sample-token');
  assert.equal(captured.url, 'https://api.example.test/api/v1/bots/@me');
  await assert.rejects(() => client.request('https://attacker.test/steal'), /inside the configured API base/);
});

test('sendContainer posts a CV2 payload and reply reference', async () => {
  let payload;
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'sent' }), { status: 201, headers: { 'content-type': 'application/json' } });
  });
  await client.sendContainer('lane/1', { title: 'Test', description: 'Body' }, { replyToId: 'message-1' });
  assert.equal(payload.components[0].type, 17);
  assert.equal(payload.replyToId, 'message-1');
  assert.equal('content' in payload, false);
});

test('calculator parses arithmetic without eval and rejects code', () => {
  assert.equal(evaluate('2 + 3 * (4 - 1)'), 11);
  assert.equal(evaluate('-2^2'), 4);
  assert.throws(() => evaluate('process.exit()'));
  assert.throws(() => evaluate('1 / 0'));
});

test('all command modules load with unique names and aliases', async () => {
  const bot = new Bot();
  const count = await bot.loadCommands();
  assert.ok(count >= 20, `expected 20+ commands, got ${count}`);
  assert.ok(bot.commands.has('help'));
  assert.ok(bot.commands.has('roominfo'));
  assert.ok(bot.commands.has('roll'));
  for (const command of bot.commands.values()) assert.equal(typeof command.execute, 'function', command.name);
});
