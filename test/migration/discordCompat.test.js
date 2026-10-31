import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscordBotAdapter, UnsupportedDiscordOperationError } from '../../src/migration/discordCompat.js';
import { VeiledClient } from '../../src/api.js';
import { DiscordBotAdapter as PackageAdapter } from 'veiledbot/migration/discord';

function makeClient() {
  const calls = [];
  const api = {
    getThread: (...args) => { calls.push(['getThread', ...args]); return Promise.resolve({ thread: { id: 'thread1', laneId: 'lane1' } }); },
    sendMessage: (...args) => { calls.push(['sendMessage', ...args]); return Promise.resolve({ id: 'm2' }); },
    sendMessage: (...args) => { calls.push(['sendMessage', ...args]); return Promise.resolve({ id: 'm1' }); },
    editMessage: (...args) => { calls.push(['editMessage', ...args]); return Promise.resolve({ id: 'm1' }); },
    deleteMessage: (...args) => { calls.push(['deleteMessage', ...args]); return Promise.resolve(null); },
    kickMember: (...args) => { calls.push(['kickMember', ...args]); return Promise.resolve(null); },
    banMember: (...args) => { calls.push(['banMember', ...args]); return Promise.resolve(null); },
    unbanMember: (...args) => { calls.push(['unbanMember', ...args]); return Promise.resolve(null); },
    timeoutMember: (...args) => { calls.push(['timeoutMember', ...args]); return Promise.resolve(null); },
    removeMemberTimeout: (...args) => { calls.push(['removeMemberTimeout', ...args]); return Promise.resolve(null); },
    createRole: (...args) => { calls.push(['createRole', ...args]); return Promise.resolve(null); },
    updateRole: (...args) => { calls.push(['updateRole', ...args]); return Promise.resolve(null); },
    assignRole: (...args) => { calls.push(['assignRole', ...args]); return Promise.resolve(null); },
    removeRole: (...args) => { calls.push(['removeRole', ...args]); return Promise.resolve(null); },
    reorderRoles: (...args) => { calls.push(['reorderRoles', ...args]); return Promise.resolve(null); },
    deleteRole: (...args) => { calls.push(['deleteRole', ...args]); return Promise.resolve(null); },
    createThread: (...args) => { calls.push(['createThread', ...args]); return Promise.resolve(null); },
    archiveThread: (...args) => { calls.push(['archiveThread', ...args]); return Promise.resolve(null); },
    unarchiveThread: (...args) => { calls.push(['unarchiveThread', ...args]); return Promise.resolve(null); },
    lockThread: (...args) => { calls.push(['lockThread', ...args]); return Promise.resolve(null); },
    unlockThread: (...args) => { calls.push(['unlockThread', ...args]); return Promise.resolve(null); },
    deleteThread: (...args) => { calls.push(['deleteThread', ...args]); return Promise.resolve(null); },
    createScheduledEvent: (...args) => { calls.push(['createScheduledEvent', ...args]); return Promise.resolve(null); },
    updateScheduledEvent: (...args) => { calls.push(['updateScheduledEvent', ...args]); return Promise.resolve(null); },
    cancelScheduledEvent: (...args) => { calls.push(['cancelScheduledEvent', ...args]); return Promise.resolve(null); },
    respondToInteraction: (...args) => { calls.push(['respondToInteraction', ...args]); return Promise.resolve(null); },
    respondToCommandInteraction: (...args) => { calls.push(['respondToCommandInteraction', ...args]); return Promise.resolve(null); },
    addReaction: (...args) => { calls.push(['addReaction', ...args]); return Promise.resolve(null); },
    removeReaction: (...args) => { calls.push(['removeReaction', ...args]); return Promise.resolve(null); },
    getReactions: (...args) => { calls.push(['getReactions', ...args]); return Promise.resolve({ reactions: [], count: 0 }); },
    getMe: () => { calls.push(['getMe']); return Promise.resolve({ user: { id: 'bot1' } }); },
    getPins: (...args) => { calls.push(['getPins', ...args]); return Promise.resolve({ pins: [] }); },
    pinMessage: (...args) => { calls.push(['pinMessage', ...args]); return Promise.resolve(null); },
    unpinMessage: (...args) => { calls.push(['unpinMessage', ...args]); return Promise.resolve(null); },
    sendTyping: (...args) => { calls.push(['sendTyping', ...args]); return Promise.resolve(null); },
    createInvite: (...args) => { calls.push(['createInvite', ...args]); return Promise.resolve({ invite: { code: 'code1' } }); },
    getRoomInvites: (...args) => { calls.push(['getRoomInvites', ...args]); return Promise.resolve({ invites: [] }); },
    getInvite: (...args) => { calls.push(['getInvite', ...args]); return Promise.resolve({ invite: { code: 'code1' } }); },
    updateInvite: (...args) => { calls.push(['updateInvite', ...args]); return Promise.resolve({ invite: { code: 'code1' } }); },
    revokeInvite: (...args) => { calls.push(['revokeInvite', ...args]); return Promise.resolve(null); },
    getLaneWebhooks: (...args) => { calls.push(['getLaneWebhooks', ...args]); return Promise.resolve({ webhooks: [] }); },
    getWebhook: (...args) => { calls.push(['getWebhook', ...args]); return Promise.resolve({ webhook: { id: 'hook1' } }); },
    createWebhook: (...args) => { calls.push(['createWebhook', ...args]); return Promise.resolve({ webhook: { id: 'hook1' }, webhookUrl: 'one-time-secret' }); },
    updateWebhook: (...args) => { calls.push(['updateWebhook', ...args]); return Promise.resolve({ webhook: { id: 'hook1' } }); },
    deleteWebhook: (...args) => { calls.push(['deleteWebhook', ...args]); return Promise.resolve(null); },
    resetWebhookToken: (...args) => { calls.push(['resetWebhookToken', ...args]); return Promise.resolve({ webhookUrl: 'rotated-one-time-secret' }); },
  };
  const listeners = new Map();
  const bot = { api, onGateway: (name, fn) => { listeners.set(name, fn); return () => listeners.delete(name); } };
  return { calls, listeners, adapter: new DiscordBotAdapter(bot) };
}

test('message create maps content, embeds, components and same-lane reply references', async () => {
  const { adapter, calls } = makeClient();
  await adapter.createMessage('lane1', {
    content: 'hello',
    embeds: [{ title: 'Info' }],
    message_reference: { message_id: 'm0', channel_id: 'lane1' },
  });
  assert.deepEqual(calls[0], ['sendMessage', 'lane1', {
    content: 'hello', embeds: [{ title: 'Info' }], replyToId: 'm0',
  }]);
});

test('message create serializes builders and accepts Veiled staged upload IDs', async () => {
  const { adapter, calls } = makeClient();
  const component = { toJSON: () => ({ type: 17, components: [{ type: 10, content: 'ready' }] }) };
  await adapter.createMessage('lane1', { components: [component], stagedUploadIds: ['upload123456'] });
  assert.deepEqual(calls[0][2], {
    components: [{ type: 17, components: [{ type: 10, content: 'ready' }] }],
    stagedUploadIds: ['upload123456'],
  });
});

test('edit and delete map to Veiled message methods', async () => {
  const { adapter, calls } = makeClient();
  await adapter.editMessage('m1', { content: 'edited' });
  await adapter.deleteMessage('m1');
  assert.equal(calls[0][0], 'editMessage');
  assert.deepEqual(calls[0][2], { content: 'edited' });
  assert.deepEqual(calls[1], ['deleteMessage', 'm1']);
});

test('message references cannot be used on edit and cross-lane replies are rejected', async () => {
  const { adapter } = makeClient();
  assert.throws(() => adapter.editMessage('m1', { message_reference: { message_id: 'm0' } }), UnsupportedDiscordOperationError);
  assert.throws(() => adapter.createMessage('lane1', { message_reference: { message_id: 'm0', channel_id: 'lane2' } }), UnsupportedDiscordOperationError);
});

test('thread messages resolve the thread channel to its parent lane and preserve thread reply references', async () => {
  const { adapter, calls } = makeClient();
  await adapter.createThreadMessage('thread1', {
    content: 'Thread reply',
    message_reference: { message_id: 'starter1', channel_id: 'thread1' },
  });
  assert.deepEqual(calls.slice(0, 2), [
    ['getThread', 'thread1'],
    ['sendMessage', 'lane1', { content: 'Thread reply', replyToId: 'starter1', threadId: 'thread1' }],
  ]);
  await adapter.createThreadMessage('thread1', {
    content: 'Parent-lane reference remains valid',
    thread_id: 'thread1',
    message_reference: { message_id: 'starter1', channel_id: 'lane1' },
  });
  assert.deepEqual(calls[3], ['sendMessage', 'lane1', { content: 'Parent-lane reference remains valid', replyToId: 'starter1', threadId: 'thread1' }]);
  await assert.rejects(adapter.createThreadMessage('thread1', { message_reference: { message_id: 'm1', channel_id: 'lane2' } }), UnsupportedDiscordOperationError);
});

test('thread message helper rejects malformed lookup results and mismatched thread IDs/references', async () => {
  const { adapter, calls } = makeClient();
  adapter.client.getThread = async () => ({ thread: { id: 'other-thread', laneId: 'lane1' } });
  await assert.rejects(adapter.createThreadMessage('thread1', { content: 'no' }), UnsupportedDiscordOperationError);
  adapter.client.getThread = async () => ({ thread: { id: 'thread1' } });
  await assert.rejects(adapter.createThreadMessage('thread1', { content: 'no' }), UnsupportedDiscordOperationError);
  adapter.client.getThread = async () => ({ thread: { id: 'thread1', laneId: 'lane1' } });
  await assert.rejects(adapter.createThreadMessage('thread1', { thread_id: 'other-thread', content: 'no' }), UnsupportedDiscordOperationError);
  await assert.rejects(adapter.createThreadMessage('thread1', { message_reference: { message_id: 'm1', channel_id: 'other-thread' } }), UnsupportedDiscordOperationError);
  assert.throws(() => adapter.createMessage('lane1', { thread_id: 'thread1', content: 'no validation lookup' }), UnsupportedDiscordOperationError);
  assert.equal(calls.filter(([name]) => name === 'sendMessage').length, 0);
});

test('Discord-specific attachment, sticker, poll, mentions, TTS and unknown fields fail explicitly', async () => {
  const { adapter } = makeClient();
  for (const payload of [
    { attachments: [{ id: 'discord-file' }] },
    { sticker_ids: ['discord-sticker'] },
    { poll: { question: 'hi' } },
    { allowed_mentions: { parse: ['everyone'] } },
    { tts: true },
    { unknownField: true },
  ]) assert.throws(() => adapter.createMessage('lane1', payload), UnsupportedDiscordOperationError);
});

test('CV2 is inferred from the top-level layout, the flag is validated but not forwarded', async () => {
  const { adapter, calls } = makeClient();
  assert.throws(() => adapter.createMessage('lane1', { flags: 32768, components: [{ type: 2 }] }), UnsupportedDiscordOperationError);
  assert.throws(() => adapter.createMessage('lane1', { flags: 32768, content: 'legacy', components: [{ type: 17, components: [{ type: 10, content: 'x' }] }] }), UnsupportedDiscordOperationError);
  await adapter.createMessage('lane1', { flags: 32768, components: [{ type: 17, components: [{ type: 10, content: 'x' }] }] });
  await adapter.createMessage('lane1', { components: [{ type: 17, components: [{ type: 10, content: 'x' }] }] });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0][2], { components: [{ type: 17, components: [{ type: 10, content: 'x' }] }] });
  assert.throws(() => adapter.createMessage('lane1', { content: 'legacy', components: [{ type: 17, components: [] }] }), UnsupportedDiscordOperationError);
});

test('moderation wrappers map reason and reject Discord-only ban options', async () => {
  const { adapter, calls } = makeClient();
  await adapter.kickMember('r1', 'u1', { reason: 'spam' });
  await adapter.banMember('r1', 'u1', { reason: 'spam' });
  await adapter.unbanMember('r1', 'u1');
  await adapter.timeoutMember('r1', 'u1', 10 * 60 * 1000, { reason: 'spam' });
  await adapter.removeTimeout('r1', 'u1');
  assert.deepEqual(calls.slice(0, 5).map((call) => call[0]), ['kickMember', 'banMember', 'unbanMember', 'timeoutMember', 'removeMemberTimeout']);
  assert.deepEqual(calls[3], ['timeoutMember', 'r1', 'u1', 600, 'spam']);
  assert.throws(() => adapter.banMember('r1', 'u1', { deleteMessageDays: 7 }), UnsupportedDiscordOperationError);
  for (const invalid of [59_000, 60_001, 2_419_201_000, '60000']) {
    assert.throws(() => adapter.timeoutMember('r1', 'u1', invalid), TypeError);
  }
});

test('role wrappers translate supported metadata and reject Discord permission bitfields', async () => {
  const { adapter, calls } = makeClient();
  await adapter.createRole('r1', { name: 'Helpers', color: 0x112233, hoist: true, mentionable: false });
  assert.deepEqual(calls[0], ['createRole', 'r1', { name: 'Helpers', color: 0x112233, hoist: true, isMentionable: false }]);
  await adapter.updateRole('role1', { name: 'Mods' });
  await adapter.assignRole('r1', 'u1', 'role1');
  await adapter.removeRole('r1', 'u1', 'role1');
  await adapter.reorderRoles('r1', [{ role_id: 'role1', position: 2 }]);
  await adapter.deleteRole('role1');
  assert.throws(() => adapter.createRole('r1', { name: 'x', permissions: '8' }), UnsupportedDiscordOperationError);
});

test('thread creation is limited to mapped public forum threads and lifecycle operations are awaited', async () => {
  const { adapter, calls } = makeClient();
  await adapter.createThread('lane1', { name: 'Topic', type: 11, message: 'First post' });
  assert.deepEqual(calls[0], ['createThread', 'lane1', { title: 'Topic', content: 'First post' }]);
  await adapter.archiveThread('thread1');
  await adapter.unarchiveThread('thread1');
  await adapter.lockThread('thread1');
  await adapter.unlockThread('thread1');
  await adapter.deleteThread('thread1');
  assert.throws(() => adapter.createThread('lane1', { name: 'Private', type: 12 }), UnsupportedDiscordOperationError);
});

test('scheduled events map Discord entity types and validate updates', async () => {
  const { adapter, calls } = makeClient();
  await adapter.createScheduledEvent('r1', {
    name: 'Show', description: 'Live', channel_id: 'lane1',
    scheduled_start_time: '2026-12-01T20:00:00Z', entity_type: 2,
  });
  assert.deepEqual(calls[0], ['createScheduledEvent', 'r1', {
    name: 'Show', description: 'Live', laneId: 'lane1',
    scheduledStartAt: '2026-12-01T20:00:00Z', locationType: 'VOICE',
  }]);
  await adapter.updateScheduledEvent('event1', { name: 'Updated' }, 'SERIES');
  await adapter.deleteScheduledEvent('event1', 'OCCURRENCE');
  assert.throws(() => adapter.updateScheduledEvent('event1', { name: 'x' }, 'BAD'), TypeError);
  assert.throws(() => adapter.createScheduledEvent('r1', { name: 'x' }), TypeError);
});

test('interaction replies map only supported immediate replies, CV2 and ephemeral state', async () => {
  const { adapter, calls } = makeClient();
  await adapter.respondToInteraction('i1', { type: 'reply', content: 'private', flags: 64 });
  assert.deepEqual(calls[0], ['respondToInteraction', 'i1', { type: 'reply', content: 'private', ephemeral: true }]);
  await adapter.respondToCommandInteraction('i2', {
    type: 'update', flags: 32768, stagedUploadIds: ['upload123456'],
    components: [{ type: 17, components: [{ type: 10, content: 'updated' }] }],
  });
  assert.equal(calls[1][2].type, 'update');
  assert.deepEqual(calls[1][2].stagedUploadIds, ['upload123456']);
  assert.equal('flags' in calls[1][2], false);
  await adapter.respondToInteraction('i4', { type: 'reply', stagedUploadIds: ['upload123456'], ephemeral: true });
  assert.deepEqual(calls[2][2], { type: 'reply', stagedUploadIds: ['upload123456'], ephemeral: true });
  await adapter.respondToInteraction('i3', { type: 'defer' });
  assert.deepEqual(calls[3], ['respondToInteraction', 'i3', { type: 'defer' }]);
  assert.throws(() => adapter.respondToInteraction('i3', { type: 'reply', stagedUploadIds: ['bad'] }), TypeError);
  assert.throws(() => adapter.respondToInteraction('i3', { type: 'reply', stagedUploadIds: Array(11).fill('upload_123456') }), TypeError);
  assert.throws(() => adapter.respondToInteraction('i3', { type: 'reply', flags: 32768, content: 'legacy', components: [{ type: 17, components: [] }] }), UnsupportedDiscordOperationError);
});

test('command callback supports defer then one final reply and strict text-input modals only', async () => {
  const { adapter, calls } = makeClient();
  await adapter.respondToCommandInteraction('i1', { type: 'defer' });
  await adapter.respondToCommandInteraction('i1', { type: 'reply', content: 'done' });
  await adapter.respondToCommandInteraction('i2', {
    type: 'modal',
    modal: { custom_id: 'feedback', title: 'Feedback', components: [{ type: 1, components: [{ type: 4, custom_id: 'body', style: 2, label: 'Details', required: true }] }] },
  });
  assert.deepEqual(calls.slice(0, 3), [
    ['respondToCommandInteraction', 'i1', { type: 'defer' }],
    ['respondToCommandInteraction', 'i1', { type: 'reply', content: 'done' }],
    ['respondToCommandInteraction', 'i2', { type: 'modal', modal: { custom_id: 'feedback', title: 'Feedback', components: [{ type: 1, components: [{ type: 4, custom_id: 'body', style: 2, label: 'Details', required: true }] }] } }],
  ]);
  assert.throws(() => adapter.respondToCommandInteraction('i3', { type: 'defer', ephemeral: true }), UnsupportedDiscordOperationError);
  assert.throws(() => adapter.respondToCommandInteraction('i3', { type: 'modal', modal: { custom_id: 'x', title: 'x', components: [{ type: 1, components: [{ type: 3, custom_id: 's', style: 1, label: 'Select' }] }] } }), UnsupportedDiscordOperationError);
  assert.throws(() => adapter.respondToInteraction('i4', { type: 'modal', modal: { custom_id: 'x', title: 'x', components: [] } }), UnsupportedDiscordOperationError);
  assert.throws(() => adapter.respondToCommandInteraction('i5', { type: 'reply', modal: {} }), UnsupportedDiscordOperationError);
});

test('reaction, pin, and typing helpers call only supported Veiled bot routes', async () => {
  const { adapter, calls } = makeClient();
  await adapter.addReaction('m1', '👍');
  await adapter.removeReaction('m1', '👍');
  const page = await adapter.listReactionUsers('m1', '👍', { limit: 25, after: 'reaction_1' });
  assert.deepEqual(page, { reactions: [], count: 0 });
  await adapter.removeUserReaction('m1', '👍', 'bot1');
  await adapter.listPins('lane1');
  await adapter.pinMessage('m1');
  await adapter.unpinMessage('m1');
  await adapter.sendTyping('lane1');
  assert.deepEqual(calls.map(([name]) => name), ['addReaction', 'removeReaction', 'getReactions', 'getMe', 'removeReaction', 'getPins', 'pinMessage', 'unpinMessage', 'sendTyping']);
  assert.deepEqual(calls[2], ['getReactions', 'm1', '👍', { limit: 25, after: 'reaction_1' }]);
  assert.throws(() => adapter.listReactionUsers('m1', '👍', { limit: 101 }), TypeError);
  const other = new DiscordBotAdapter({ ...makeClient().adapter.client, getMe: async () => ({ user: { id: 'other-bot' } }) });
  await assert.rejects(other.removeUserReaction('m1', '👍', 'user1'), UnsupportedDiscordOperationError);
});

test('invite wrappers convert supported Discord lifetime fields and reject unsupported fields', async () => {
  const { adapter, calls } = makeClient();
  await adapter.createInvite('room1', { max_age: 3600, max_uses: 10, temporary: true });
  await adapter.listInvites('room1');
  await adapter.getInvite('code1');
  await adapter.updateInvite('code1', { max_age: 0, max_uses: 0 });
  await adapter.revokeInvite('code1');
  assert.deepEqual(calls.slice(0, 5), [
    ['createInvite', 'room1', { maxAge: 3600, maxUses: 10, temporary: true }],
    ['getRoomInvites', 'room1'], ['getInvite', 'code1'],
    ['updateInvite', 'code1', { maxAge: 0, maxUses: 0 }], ['revokeInvite', 'code1'],
  ]);
  assert.throws(() => adapter.createInvite('room1', { max_age: 2_592_001 }), TypeError);
  assert.throws(() => adapter.createInvite('room1', { max_uses: 1.5 }), TypeError);
  assert.throws(() => adapter.createInvite('room1', { channel_id: 'lane1' }), UnsupportedDiscordOperationError);
});

test('webhook management is strict, exposes raw results to caller, and rejects Discord execution/avatar bytes', async () => {
  const { adapter, calls } = makeClient();
  await adapter.listWebhooks('lane1');
  await adapter.getWebhook('hook1');
  const created = await adapter.createWebhook('lane1', { name: 'Alerts', avatar_url: 'https://cdn.example.test/avatar.png' });
  await adapter.updateWebhook('hook1', { name: 'Alerts v2', channel_id: 'lane2', avatar_url: null });
  await adapter.rotateWebhookToken('hook1');
  await adapter.deleteWebhook('hook1');
  assert.deepEqual(calls.map(([name]) => name), ['getLaneWebhooks', 'getWebhook', 'createWebhook', 'updateWebhook', 'resetWebhookToken', 'deleteWebhook']);
  assert.deepEqual(calls[2], ['createWebhook', 'lane1', { name: 'Alerts', avatarUrl: 'https://cdn.example.test/avatar.png' }]);
  assert.deepEqual(calls[3], ['updateWebhook', 'hook1', { name: 'Alerts v2', laneId: 'lane2', avatarUrl: null }]);
  assert.equal(created.webhookUrl, 'one-time-secret');
  assert.throws(() => adapter.createWebhook('lane1', { name: 'x', avatar: 'data:image/png;base64,AAAA' }), UnsupportedDiscordOperationError);
  assert.throws(() => adapter.executeWebhook('hook1', { content: 'cross-post' }), UnsupportedDiscordOperationError);
  assert.throws(() => adapter.createWebhook('lane1', { name: 'x', content: 'not management metadata' }), UnsupportedDiscordOperationError);
});

test('VeiledClient reaction-user pagination encodes query and emoji safely', async () => {
  let requestedUrl;
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (url) => {
    requestedUrl = String(url);
    return new Response('{"reactions":[],"count":0}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await client.getReactions('message1', 'custom:with space', { limit: 20, after: 'reaction1' });
  const parsed = new URL(requestedUrl);
  assert.equal(parsed.pathname, '/api/v1/messages/message1/reactions/custom%3Awith%20space');
  assert.equal(parsed.searchParams.get('limit'), '20');
  assert.equal(parsed.searchParams.get('after'), 'reaction1');
});

test('gateway projection only subscribes to named Veiled events and returns an unsubscribe function', () => {
  const { adapter, listeners } = makeClient();
  const received = [];
  const off = adapter.on('messageCreate', (event) => received.push(event));
  listeners.get('MESSAGE_CREATE')({ roomId: 'room1', laneId: 'lane1', message: { id: 'm1' } });
  assert.equal(received[0].guild_id, 'room1');
  assert.equal(received[0].channel_id, 'lane1');
  assert.equal(received[0].id, 'm1');
  assert.equal(received[0].veiledEvent, 'MESSAGE_CREATE');
  assert.equal(off(), true);
  assert.equal(listeners.has('MESSAGE_CREATE'), false);
});

test('unsupported Discord events fail instead of receiving fabricated payloads', () => {
  const { adapter } = makeClient();
  for (const event of ['presenceUpdate', 'typingStart', 'channelCreate', 'threadMembersUpdate', 'guildScheduledEventCreate']) {
    assert.throws(() => adapter.on(event, () => {}), UnsupportedDiscordOperationError);
  }
});

test('verified lifecycle events map as validated plain projections rather than discord.js objects', () => {
  const cases = [
    ['MESSAGE_REACTION_ADD', 'messageReactionAdd', { messageId: 'm1', userId: 'u1', emoji: '👍' }, { messageId: 'm1', user_id: 'u1', emoji: '👍' }],
    ['MEMBER_JOIN', 'guildMemberAdd', { roomId: 'r1', userId: 'u1' }, { guild_id: 'r1', user_id: 'u1' }],
    ['MEMBER_LEAVE', 'guildMemberRemove', { roomId: 'r1', userId: 'u1', reason: 'LEFT' }, { guild_id: 'r1', user_id: 'u1' }],
    ['MEMBER_BAN', 'guildBanAdd', { roomId: 'r1', userId: 'u1' }, { guild_id: 'r1', user_id: 'u1' }],
    ['MEMBER_TIMEOUT', 'guildMemberUpdate', { roomId: 'r1', userId: 'u1', timeoutUntil: null }, { guild_id: 'r1', user_id: 'u1' }],
    ['MEMBER_ROLE_ADD', 'guildMemberUpdate', { roomId: 'r1', userId: 'u1', roleId: 'role1' }, { guild_id: 'r1', user_id: 'u1', role_id: 'role1' }],
    ['ROLE_CREATE', 'roleCreate', { roomId: 'r1', role: { id: 'role1', name: 'Mods' } }, { guild_id: 'r1', id: 'role1', role: { id: 'role1', name: 'Mods' } }],
    ['ROLE_DELETE', 'roleDelete', { roomId: 'r1', roleId: 'role1' }, { guild_id: 'r1', role_id: 'role1' }],
    ['THREAD_CREATE', 'threadCreate', { roomId: 'r1', laneId: 'l1', threadId: 't1', name: 'Topic', isPrivate: false }, { guild_id: 'r1', channel_id: 'l1', id: 't1' }],
    ['THREAD_UPDATE', 'threadUpdate', { roomId: 'r1', laneId: 'l1', threadId: 't1', isArchived: true }, { guild_id: 'r1', channel_id: 'l1', id: 't1' }],
    ['THREAD_DELETE', 'threadDelete', { roomId: 'r1', laneId: 'l1', threadId: 't1', isPrivate: false }, { guild_id: 'r1', channel_id: 'l1', id: 't1' }],
    ['INVITE_CREATE', 'inviteCreate', { roomId: 'r1', inviteId: 'invite1', maxAge: 30 }, { guild_id: 'r1', id: 'invite1', invite_id: 'invite1' }],
    ['INVITE_UPDATE', 'inviteUpdate', { roomId: 'r1', inviteId: 'invite1', maxUses: 3 }, { guild_id: 'r1', id: 'invite1', invite_id: 'invite1' }],
    ['INVITE_DELETE', 'inviteDelete', { roomId: 'r1', inviteId: 'invite1' }, { guild_id: 'r1', id: 'invite1', invite_id: 'invite1' }],
    ['WEBHOOK_CREATE', 'webhookUpdate', { roomId: 'r1', laneId: 'l1', webhookId: 'hook1', name: 'Alerts' }, { guild_id: 'r1', channel_id: 'l1', id: 'hook1' }],
    ['WEBHOOK_UPDATE', 'webhookUpdate', { roomId: 'r1', laneId: 'l1', webhookId: 'hook1', avatarUrl: null }, { guild_id: 'r1', channel_id: 'l1', id: 'hook1' }],
    ['WEBHOOK_DELETE', 'webhookUpdate', { roomId: 'r1', laneId: 'l1', webhookId: 'hook1' }, { guild_id: 'r1', channel_id: 'l1', id: 'hook1' }],
    ['VOICE_ROSTER_UPDATE', 'voiceStateUpdate', { roomId: 'r1', laneId: 'l1', userId: 'u1', action: 'join' }, { guild_id: 'r1', channel_id: 'l1', user_id: 'u1' }],
    ['SCHEDULED_EVENT_UPDATE', 'guildScheduledEventUpdate', { roomId: 'r1', eventId: 'event1', action: 'UPDATED' }, { guild_id: 'r1', id: 'event1', action: 'UPDATED' }],
  ];
  for (const [veiledName, discordName, payload, expected] of cases) {
    const { adapter, listeners } = makeClient();
    let received;
    adapter.on(discordName, (event) => { received = event; });
    listeners.get(veiledName)(payload);
    assert.equal(received.veiledEvent, veiledName);
    assert.equal(received.discordName, discordName);
    assert.equal(received.projectionOnly, true);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(received[key], value, veiledName + ' ' + key);
  }
});

test('lifecycle projections reject missing IDs and aggregate shared webhook/member update events', () => {
  const invalid = [
    ['messageReactionAdd', 'MESSAGE_REACTION_ADD', { userId: 'u1', emoji: 'x' }],
    ['guildMemberAdd', 'MEMBER_JOIN', { roomId: 'r1' }],
    ['guildMemberUpdate', 'MEMBER_ROLE_ADD', { roomId: 'r1', userId: 'u1' }],
    ['roleCreate', 'ROLE_CREATE', { roomId: 'r1', role: { name: 'No ID' } }],
    ['threadCreate', 'THREAD_CREATE', { roomId: 'r1', laneId: 'l1' }],
    ['inviteCreate', 'INVITE_CREATE', { roomId: 'r1' }],
    ['webhookUpdate', 'WEBHOOK_CREATE', { roomId: 'r1', laneId: 'l1' }],
    ['voiceStateUpdate', 'VOICE_ROSTER_UPDATE', { roomId: 'r1', laneId: 'l1', userId: 'u1', action: 'move' }],
    ['guildScheduledEventUpdate', 'SCHEDULED_EVENT_UPDATE', { roomId: 'r1', eventId: 'event1' }],
  ];
  for (const [discordName, veiledName, payload] of invalid) {
    const { adapter, listeners } = makeClient();
    adapter.on(discordName, () => {});
    assert.throws(() => listeners.get(veiledName)(payload), TypeError, veiledName);
  }
  const { adapter, listeners } = makeClient();
  const received = [];
  adapter.on('webhookUpdate', (event) => received.push(event.veiledEvent));
  for (const name of ['WEBHOOK_CREATE', 'WEBHOOK_UPDATE', 'WEBHOOK_DELETE']) listeners.get(name)({ roomId: 'r1', laneId: 'l1', webhookId: 'hook1' });
  assert.deepEqual(received, ['WEBHOOK_CREATE', 'WEBHOOK_UPDATE', 'WEBHOOK_DELETE']);
});

test('message gateway projections require verifiable IDs and mark themselves as plain projections', () => {
  const { adapter, listeners } = makeClient();
  let received;
  adapter.on('messageUpdate', (event) => { received = event; });
  listeners.get('MESSAGE_UPDATE')({ id: 'm1', laneId: 'lane1', lane: { roomId: 'room1' }, content: 'edited' });
  assert.equal(received.id, 'm1');
  assert.equal(received.channel_id, 'lane1');
  assert.equal(received.guild_id, 'room1');
  assert.equal(received.projectionOnly, true);
  assert.throws(() => listeners.get('MESSAGE_UPDATE')({ messageId: 'm1' }), TypeError);
});

test('interaction gateway projection validates required fields and preserves source envelope', () => {
  const { adapter, listeners } = makeClient();
  let received;
  adapter.on('interactionCreate', (event) => { received = event; });
  listeners.get('INTERACTION_CREATE')({
    interaction_id: 'i1', application_id: 'app1', channel_id: 'lane1', type: 2,
    data: { name: 'ping' }, user: { id: 'u1' },
  });
  assert.equal(received.id, 'i1');
  assert.equal(received.interaction_id, 'i1');
  assert.equal(received.channel_id, 'lane1');
  assert.equal(received.projectionOnly, true);
  assert.throws(() => listeners.get('INTERACTION_CREATE')({ interaction_id: 'i1' }), TypeError);
});

test('package subpath exposes the adapter without changing the root package entrypoint', () => {
  assert.equal(PackageAdapter, DiscordBotAdapter);
});
