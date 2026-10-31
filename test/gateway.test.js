import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Bot } from '../src/bot.js';
import { BOT_GATEWAY_INTENTS, DEFAULT_BOT_GATEWAY_INTENTS, config, parseGatewayIntents, validateConfig } from '../src/config.js';

class MockGateway extends EventEmitter {
  connected = true;
  sent = [];
  emit(name, payload, callback) {
    if (name === 'gateway:ack') {
      this.sent.push({ name, payload });
      callback?.({ success: true });
      return true;
    }
    return super.emit(name, payload, callback);
  }
  connect() { this.connected = true; this.emit('connect'); }
  disconnect() { this.connected = false; }
}

test('gateway intent names and defaults match Veiled bot gateway policy', () => {
  const expectedDefault = ['ROOMS', 'MESSAGES', 'REACTIONS', 'THREADS', 'INVITES', 'WEBHOOKS', 'POLLS', 'MODERATION', 'VOICE_STATES', 'SCHEDULED_EVENTS', 'INTERACTIONS', 'ROLES']
    .reduce((mask, name) => mask | BOT_GATEWAY_INTENTS[name], 0);
  assert.equal(DEFAULT_BOT_GATEWAY_INTENTS, expectedDefault);
  assert.equal(parseGatewayIntents(), expectedDefault);
  assert.equal(parseGatewayIntents('rooms, MESSAGE_CONTENT, members'), BOT_GATEWAY_INTENTS.ROOMS | BOT_GATEWAY_INTENTS.MESSAGE_CONTENT | BOT_GATEWAY_INTENTS.MEMBERS);
  assert.equal(parseGatewayIntents('12'), 12);
  assert.throws(() => parseGatewayIntents('ROOMS,DISCORD_GUILDS'), /Unknown Veiled gateway intent/);
  assert.throws(() => parseGatewayIntents('32768'), /unknown intent bits/);
});

test('gateway shard config enforces the server-supported shard tuple bounds', () => {
  assert.equal(validateConfig({ ...config, token: 'fixture', shard: [0, 1] }), true);
  assert.throws(() => validateConfig({ ...config, token: 'fixture', shard: [1, 1] }), /0 <= VEILED_BOT_SHARD_ID/);
  assert.throws(() => validateConfig({ ...config, token: 'fixture', shard: [0, 1025] }), /0 <= VEILED_BOT_SHARD_ID/);
  assert.throws(() => validateConfig({ ...config, token: 'fixture', shard: [0, 1], gatewayIntents: 32768 }), /invalid or unknown intent bits/);
});

test('startup sends the verified auth tuple and binds listeners before opening Socket.IO', async () => {
  const gateway = new MockGateway();
  let captured;
  let listenersBoundAtConnect = false;
  const gatewayFactory = (_url, options) => { captured = options; return gateway; };
  const api = {
    token: 'fixture-token',
    getMe: async () => ({ user: { id: 'bot-1', username: 'Fixture' } }),
    getGateway: async () => ({ url: 'https://gateway.example.test' }),
  };
  const bot = new Bot({
    config: { ...config, token: 'fixture-token', gatewayUrl: 'https://gateway.example.test', gatewayIntents: 7, shard: [2, 4] },
    gatewayFactory,
    api,
    installSignalHandlers: false,
  });
  bot.afk = { load() {} };
  bot.reminders = { load() {}, close() {} };
  bot.loadCommands = async () => 0;
  bot.loadEvents = async () => {
    bot.onGateway('MESSAGE_CREATE', () => {});
    gateway.once('connect', () => { listenersBoundAtConnect = gateway.listenerCount('MESSAGE_CREATE') > 0; });
  };
  const originalLog = console.log;
  console.log = () => {};
  try { await bot.start(); } finally { console.log = originalLog; }
  assert.deepEqual(captured.auth, { token: 'Bot fixture-token', intents: 7, shard: [2, 4] });
  assert.equal(captured.autoConnect, false);
  assert.deepEqual(captured.transports, ['websocket', 'polling']);
  assert.equal(listenersBoundAtConnect, true);
});

test('successfully handled replay events acknowledge exactly the server gateway cursor field', async () => {
  const bot = new Bot({ config: { ...config, token: 'fixture' } });
  const gateway = new MockGateway();
  bot.gateway = gateway;
  const received = [];
  bot.onGateway('MESSAGE_CREATE', async (payload) => { received.push(payload.message.id); });
  const payload = { message: { id: 'message-1' }, gateway_event_id: 'outbox-1', gateway_event_replayed: true };
  assert.equal(await bot.dispatchGatewayEvent('MESSAGE_CREATE', payload), true);
  assert.deepEqual(received, ['message-1']);
  assert.deepEqual(gateway.sent, [{ name: 'gateway:ack', payload: { eventId: 'outbox-1' } }]);
});

test('failed replay handler is not acknowledged so the server can redeliver it', async () => {
  const bot = new Bot({ config: { ...config, token: 'fixture' } });
  const gateway = new MockGateway();
  bot.gateway = gateway;
  bot.onGateway('MESSAGE_UPDATE', async () => { throw new Error('fixture failure'); });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await bot.dispatchGatewayEvent('MESSAGE_UPDATE', { gateway_event_id: 'outbox-2', gateway_event_replayed: true }), false);
    assert.deepEqual(gateway.sent, []);
  } finally { console.error = originalError; }
});

test('transient events are never acknowledged as durable replay', async () => {
  const bot = new Bot({ config: { ...config, token: 'fixture' } });
  const gateway = new MockGateway();
  bot.gateway = gateway;
  await bot.dispatchGatewayEvent('TYPING_START', { gateway_event_id: 'not-durable', gateway_event_replayed: true });
  assert.deepEqual(gateway.sent, []);
});
