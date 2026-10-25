import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer, isValidContainerPayload } from '../src/containers.js';
import { VeiledClient } from '../src/api.js';
import { evaluate } from '../src/commands/utility/calc.js';
import { Bot } from '../src/bot.js';
import { createHelpComponents } from '../src/commands/utility/help.js';

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
  const helpText = createHelpComponents(bot).flatMap((root) => root.components).filter((component) => component.type === 10).map((component) => component.content).join(' ');
  assert.ok(helpText.includes('**!afk**'));
  assert.ok(helpText.includes('**!voiceinfo**'));
  for (const command of bot.commands.values()) assert.equal(typeof command.execute, 'function', command.name);
});

test('AFK state persists across bot restarts and supports clear', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { AfkStore } = await import('../src/state.js');
  const dir = mkdtempSync(join(tmpdir(), 'veiledbot-afk-'));
  try {
    const first = new AfkStore(dir); first.load(); first.set('u1', 'out for lunch');
    const second = new AfkStore(dir); second.load();
    assert.equal(second.get('u1').reason, 'out for lunch');
    assert.equal(second.clear('u1'), true);
    assert.equal(second.get('u1'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('reminders persist, are scoped to their owner, and support bounded durations', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { ReminderStore, parseDuration } = await import('../src/state.js');
  const dir = mkdtempSync(join(tmpdir(), 'veiledbot-reminders-'));
  const client = { sendContainer: async () => {} };
  try {
    assert.equal(parseDuration('1w2d3h4m5s'), 788645);
    assert.equal(parseDuration('31d'), null);
    assert.equal(parseDuration('next friday'), null);
    const first = new ReminderStore(client, dir);
    const reminder = first.create({ userId: 'u1', laneId: 'lane1', text: 'test', dueAt: Date.now() + 60_000 });
    first.close();
    const second = new ReminderStore(client, dir); second.load();
    assert.equal(second.list('u1').length, 1);
    assert.equal(second.list('u2').length, 0);
    assert.equal(second.cancel('u2', reminder.id), false);
    assert.equal(second.cancel('u1', reminder.id), true);
    second.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('failed reminder deliveries are retained and retried instead of being lost', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { ReminderStore } = await import('../src/state.js');
  const dir = mkdtempSync(join(tmpdir(), 'veiledbot-reminder-retry-'));
  const client = { sendContainer: async () => { throw new Error('temporary network issue'); } };
  const store = new ReminderStore(client, dir);
  try {
    const entry = store.create({ userId: 'u1', laneId: 'lane1', text: 'retry me', dueAt: Date.now() + 10 });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(store.list('u1').length, 1);
    assert.equal(store.list('u1')[0].id, entry.id);
    assert.equal(store.list('u1')[0].attempts, 1);
    assert.equal(store.cancel('u1', entry.id), true);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('new pin and voice methods use the current Bot API route shapes', async () => {
  const requests = [];
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (url, options) => {
    requests.push({ path: new URL(String(url)).pathname, method: options.method, body: options.body });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await client.getPins('lane1');
  await client.pinMessage('message1');
  await client.unpinMessage('message1');
  await client.getVoiceStates('voice1');
  await client.joinVoice('voice1');
  await client.leaveVoice('voice1');
  assert.deepEqual(requests.map(({ path, method }) => [path, method]), [
    ['/api/v1/lanes/lane1/pins', 'GET'],
    ['/api/v1/messages/message1/pin', 'POST'],
    ['/api/v1/messages/message1/pin', 'DELETE'],
    ['/api/v1/lanes/voice1/voice-states', 'GET'],
    ['/api/v1/voice/join', 'POST'],
    ['/api/v1/voice/leave', 'POST'],
  ]);
  assert.equal(JSON.parse(requests[4].body).laneId, 'voice1');
});
