import test from 'node:test';
import assert from 'node:assert/strict';
import messageCreateEvent, { normalizeMessagePayload } from '../src/events/messageCreate.js';

test('normalizeMessagePayload correctly extracts nested and flat gateway payloads', () => {
  // Nested gateway payload (standard Veiled event envelope)
  const nested = {
    roomId: 'room-1',
    laneId: 'lane-1',
    message: {
      id: 'msg-1',
      content: '!ping',
      author: { id: 'user-1', username: 'TestUser' },
    },
  };
  const normalizedNested = normalizeMessagePayload(nested);
  assert.equal(normalizedNested.id, 'msg-1');
  assert.equal(normalizedNested.laneId, 'lane-1');
  assert.equal(normalizedNested.roomId, 'room-1');
  assert.equal(normalizedNested.author.id, 'user-1');
  assert.equal(normalizedNested.content, '!ping');

  // Flat payload
  const flat = {
    id: 'msg-2',
    channel_id: 'lane-2',
    guild_id: 'room-2',
    content: ',help',
    author: { id: 'user-2', username: 'TestUser2' },
  };
  const normalizedFlat = normalizeMessagePayload(flat);
  assert.equal(normalizedFlat.id, 'msg-2');
  assert.equal(normalizedFlat.laneId, 'lane-2');
  assert.equal(normalizedFlat.roomId, 'room-2');
  assert.equal(normalizedFlat.author.id, 'user-2');
  assert.equal(normalizedFlat.content, ',help');
});

test('messageCreate executes command with configured prefix and fallback prefix', async () => {
  let executedCommand = null;
  let executedArgs = null;
  let sentContainer = null;

  const fakeBot = {
    user: { id: 'bot-1', username: 'VeiledBot' },
    config: { commandPrefix: ',' },
    afk: { get: () => null, clear: () => {} },
    aliases: new Map(),
    commands: new Map([
      ['ping', {
        name: 'ping',
        execute: async (ctx) => {
          executedCommand = ctx;
        },
      }],
    ]),
    consumeCooldown: () => 0,
    api: {
      sendContainer: async (laneId, card, opts) => {
        sentContainer = { laneId, card, opts };
      },
    },
  };

  // 1. Test with configured prefix ','
  await messageCreateEvent.execute(fakeBot, {
    roomId: 'room-1',
    laneId: 'lane-1',
    message: {
      id: 'msg-1',
      content: ',ping hello world',
      author: { id: 'user-1', username: 'User1' },
    },
  });

  assert.ok(executedCommand);
  assert.equal(executedCommand.prefix, ',');
  assert.deepEqual(executedCommand.args, ['hello', 'world']);

  // Reset
  executedCommand = null;

  // 2. Test with fallback prefix '!'
  await messageCreateEvent.execute(fakeBot, {
    roomId: 'room-1',
    laneId: 'lane-1',
    message: {
      id: 'msg-2',
      content: '!ping fallback test',
      author: { id: 'user-1', username: 'User1' },
    },
  });

  assert.ok(executedCommand);
  assert.equal(executedCommand.prefix, '!');
  assert.deepEqual(executedCommand.args, ['fallback', 'test']);
});
