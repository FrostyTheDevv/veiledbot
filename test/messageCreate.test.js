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

test('messageCreate sends a DM container when a highlighted word is triggered', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { HighlightStore } = await import('../src/state.js');
  const dir = mkdtempSync(join(tmpdir(), 'veiledbot-hl-msg-'));

  try {
    const highlights = new HighlightStore(dir);
    highlights.load();
    highlights.add('watcher-1', 'giveaway', { roomId: 'room-1' });
    highlights.prioritize('watcher-1', 1, 1, 'room-1');

    const dmSent = [];
    const fakeBot = {
      user: { id: 'bot-1', username: 'VeiledBot' },
      config: { commandPrefix: ',' },
      afk: { get: () => null, clear: () => {} },
      highlights,
      aliases: new Map(),
      commands: new Map(),
      consumeCooldown: () => 0,
      getLaneInfo: async () => ({ id: 'lane-1', name: 'general', roomId: 'room-1', roomName: 'Veiled HQ' }),
      api: {
        sendDmContainer: async (userId, card) => {
          dmSent.push({ userId, card });
        },
        sendContainer: async () => {},
      },
    };

    // Another user says the highlighted word -> sends DM container
    await messageCreateEvent.execute(fakeBot, {
      roomId: 'room-1',
      laneId: 'lane-1',
      message: {
        id: 'msg-10',
        content: 'Hey everyone, new giveaway starting soon!',
        author: { id: 'speaker-2', username: 'Speaker' },
      },
    });

    assert.equal(dmSent.length, 1);
    assert.equal(dmSent[0].userId, 'watcher-1');
    assert.match(dmSent[0].card.title, /Priority highlight triggered/);
    assert.match(dmSent[0].card.description, /giveaway/);
    assert.match(dmSent[0].card.description, /Hey everyone, new giveaway starting soon/);

    // Watcher's own message should NOT trigger a DM to themselves
    await messageCreateEvent.execute(fakeBot, {
      roomId: 'room-1',
      laneId: 'lane-1',
      message: {
        id: 'msg-11',
        content: 'My own giveaway message',
        author: { id: 'watcher-1', username: 'Watcher' },
      },
    });
    assert.equal(dmSent.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
