import test from 'node:test';
import assert from 'node:assert/strict';
import command from '../src/commands/rooms/roleautomation.js';
import memberJoin from '../src/events/memberJoin.js';
import reactionAdd from '../src/events/reactionAdd.js';
import reactionRemove from '../src/events/reactionRemove.js';
import interactionCreate from '../src/events/interactionCreate.js';

function harness(args) {
  const sent = [];
  const calls = [];
  const client = {
    getRoleAutomation: async () => ({ rules: [] }),
    upsertRoleAutomation: async (roomId, payload) => { calls.push(['upsert', roomId, payload]); return { rule: { id: 'rule-1' } }; },
    deleteRoleAutomation: async (...values) => calls.push(['delete', ...values]),
    sendContainer: async (...values) => sent.push(values),
  };
  const bot = { getLaneInfo: async () => ({ roomId: 'room-1' }) };
  return { client, bot, message: { laneId: 'lane-1', id: 'message-1' }, args, sent, calls };
}

test('roleautomation persists custom-role configuration', async () => {
  const ctx = harness(['add', 'CUSTOM_ROLE', 'role-1', 'hello']);
  await command.execute({ ...ctx, prefix: '!' });
  assert.deepEqual(ctx.calls[0], ['upsert', 'room-1', { roleId: 'role-1', ruleType: 'CUSTOM_ROLE', trigger: 'hello' }]);
});

test('roleautomation persists temporary target and expiry', async () => {
  const ctx = harness(['add', 'TEMPORARY_ROLE', 'role-1', 'user-1', '60']);
  await command.execute({ ...ctx, prefix: '!' });
  assert.equal(ctx.calls[0][2].config.userId, 'user-1');
  assert.equal(ctx.calls[0][2].durationSeconds, 60);
  assert.match(ctx.calls[0][2].expiresAt, /^\d{4}-/);
});

test('member join applies enabled autorole rules', async () => {
  const calls = [];
  const bot = { api: { getRoleAutomation: async () => ({ rules: [{ enabled: true, ruleType: 'AUTOROLE', roleId: 'role-1' }] }), assignRole: async (...args) => calls.push(args) } };
  await memberJoin.execute(bot, { roomId: 'room-1', userId: 'user-1' });
  assert.deepEqual(calls, [['room-1', 'user-1', 'role-1']]);
});

test('reaction role add/remove maps emoji to the configured role', async () => {
  const calls = [];
  const bot = { api: { getRoleAutomation: async () => ({ rules: [{ enabled: true, ruleType: 'REACTION_ROLE', trigger: '⭐', roleId: 'role-1' }] }), assignRole: async (...args) => calls.push(['add', ...args]), removeRole: async (...args) => calls.push(['remove', ...args]) } };
  await reactionAdd.execute(bot, { roomId: 'room-1', userId: 'user-1', emoji: '⭐' });
  await reactionRemove.execute(bot, { roomId: 'room-1', userId: 'user-1', emoji: '⭐' });
  assert.deepEqual(calls, [['add', 'room-1', 'user-1', 'role-1'], ['remove', 'room-1', 'user-1', 'role-1']]);
});

test('button role interaction toggles the configured role', async () => {
  const calls = [];
  const bot = {
    getLaneInfo: async () => ({ roomId: 'room-1' }),
    api: {
      getRoleAutomation: async () => ({ rules: [{ enabled: true, ruleType: 'BUTTON_ROLE', trigger: 'vip', roleId: 'role-1' }] }),
      getMemberRoles: async () => ({ roles: [] }),
      assignRole: async (...args) => calls.push(['add', ...args]),
      respondToInteraction: async (...args) => calls.push(['reply', ...args]),
    },
    config: { commandPrefix: '!' },
    prefixes: new Map(),
  };
  await interactionCreate.execute(bot, { id: 'interaction-1', channel_id: 'lane-1', user: { id: 'user-1' }, data: { custom_id: 'veiledbot:rolebutton:vip' } });
  assert.deepEqual(calls[0], ['add', 'room-1', 'user-1', 'role-1']);
  assert.equal(calls[1][0], 'reply');
});
