import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer, isValidContainerPayload } from '../src/containers.js';
import { VeiledClient } from '../src/api.js';
import { Bot } from '../src/bot.js';
import { EventEmitter } from 'node:events';
import { GATEWAY_EVENT_NAMES, isGatewayEventName } from '../src/events/names.js';
import { createHelpComponents } from '../src/commands/utility/help.js';
import timezoneCommand, { formatTimeZone } from '../src/commands/utility/timezone.js';
import { COLOR_THEMES, colorDetails, randomPalette } from '../src/commands/utility/palette.js';
import githubCommand, { parseGitHubTarget } from '../src/commands/utility/github.js';
import wikipediaCommand, { parseWikipediaQuery } from '../src/commands/utility/wikipedia.js';
import rpsCommand, { playRound } from '../src/commands/fun/rps.js';
import inviteCommand, { parseInviteLifetime } from '../src/commands/rooms/invite.js';
import invitesCommand from '../src/commands/rooms/invites.js';
import revokeInviteCommand, { isInviteCode } from '../src/commands/rooms/revokeinvite.js';
import eventsCommand from '../src/commands/rooms/events.js';
import eventCreateCommand, { parseEventInput } from '../src/commands/rooms/eventcreate.js';
import eventRsvpCommand from '../src/commands/rooms/eventrsvp.js';
import threadStateCommand from '../src/commands/rooms/threadstate.js';
import moderateCommand, { parseTimeoutDuration } from '../src/commands/rooms/moderate.js';
import roleOpsCommand from '../src/commands/rooms/roleops.js';
import eventUpdateCommand, { parseEventUpdate } from '../src/commands/rooms/eventupdate.js';
import eventCancelCommand from '../src/commands/rooms/eventcancel.js';
import capabilitiesCommand from '../src/commands/rooms/capabilities.js';
import webhooksCommand from '../src/commands/rooms/webhooks.js';
import pollCommand from '../src/commands/messages/poll.js';
import avatarCommand from '../src/commands/utility/avatar.js';
import selfPrefixCommand from '../src/commands/utility/selfprefix.js';
import cardCommand from '../src/commands/utility/card.js';
import roomInfoCommand from '../src/commands/rooms/roominfo.js';
import roomsCommand from '../src/commands/rooms/rooms.js';
import roomStatsCommand from '../src/commands/rooms/roomstats.js';
import historyCommand from '../src/commands/messages/history.js';
import reactCommand, { parseAutoReactAdd } from '../src/commands/messages/react.js';
import highlightCommand, { parseHighlightBulkInput } from '../src/commands/utility/highlight.js';
import forwardCommand from '../src/commands/messages/forward.js';

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

test('container builder supports media galleries, thumbnails, and interactive action rows', () => {
  const payload = createContainer({
    title: 'Showcase',
    description: 'Body',
    thumbnail: 'https://cdn.veiled.lol/avatars/test.png',
    images: [{ url: 'https://cdn.veiled.lol/banners/test.png', description: 'Banner' }],
    spoiler: true,
    actionRows: [{ type: 1, components: [{ type: 2, style: 1, label: 'Click', custom_id: 'btn:1' }] }],
  });
  assert.equal(payload[0].type, 17);
  assert.equal(payload[0].spoiler, true);
  assert.ok(payload[0].components.some((c) => c.type === 9 && c.accessory?.type === 11));
  assert.ok(payload[0].components.some((c) => c.type === 12 && c.items[0].media.url === 'https://cdn.veiled.lol/banners/test.png'));
  assert.ok(payload[0].components.some((c) => c.type === 1 && c.components[0].custom_id === 'btn:1'));
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

test('gateway event registry matches the supported Veiled event names and listeners can be removed', () => {
  assert.equal(new Set(GATEWAY_EVENT_NAMES).size, GATEWAY_EVENT_NAMES.length);
  assert.equal(isGatewayEventName('MESSAGE_CREATE'), true);
  assert.equal(isGatewayEventName('GUILD_MEMBER_ADD'), false);
  const bot = new Bot();
  const gateway = new EventEmitter();
  bot.gateway = gateway;
  let received = 0;
  const remove = bot.onGateway('ROOM_UPDATE', () => { received += 1; });
  gateway.emit('ROOM_UPDATE', { roomId: 'room-1' });
  assert.equal(received, 1);
  assert.equal(remove(), true);
  gateway.emit('ROOM_UPDATE', { roomId: 'room-1' });
  assert.equal(received, 1);
  assert.throws(() => bot.onGateway('GUILD_MEMBER_ADD', () => {}), /Unsupported Veiled gateway event/);
});

test('invite command only accepts supported durations and creates a real room invite', async () => {
  assert.equal(parseInviteLifetime(undefined), 7 * 24 * 60 * 60);
  assert.equal(parseInviteLifetime('1h'), 60 * 60);
  assert.equal(parseInviteLifetime('30d'), 30 * 24 * 60 * 60);
  assert.equal(parseInviteLifetime('never'), 0);
  assert.equal(parseInviteLifetime('365d'), null);
  let inviteInput;
  let response;
  await inviteCommand.execute({
    bot: { getLaneInfo: async () => ({ roomId: 'room1' }) },
    client: {
      createInvite: async (roomId, options) => { inviteInput = { roomId, options }; return { invite: { code: 'abc123' } }; },
      sendContainer: async (_laneId, payload) => { response = payload; },
    },
    message: { laneId: 'lane1', id: 'message1' },
    args: ['1d'],
  });
  assert.deepEqual(inviteInput, { roomId: 'room1', options: { maxAge: 86400 } });
  assert.match(response.description, /https:\/\/veiled\.lol\/invite\/abc123/);
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

test('timezone utility formats IANA zones and rejects unknown values', () => {
  const now = new Date('2026-01-15T12:00:00.000Z');
  const result = formatTimeZone('America/New_York', now);
  assert.equal(result.timeZone, 'America/New_York');
  assert.match(result.local, /7:00:00 AM/);
  assert.equal(result.utc, now.toISOString());
  assert.equal(formatTimeZone('Mars/Olympus', now), null);
  assert.equal(formatTimeZone('x'.repeat(101), now), null);
  assert.equal(formatTimeZone('', now), null);
});

test('palette utility returns valid theme colors and deterministic random palettes', () => {
  assert.equal(Object.keys(COLOR_THEMES).length, 10);
  const palette = randomPalette(() => 0x123abc);
  assert.deepEqual(palette, Array(5).fill('#123ABC'));
  assert.deepEqual(colorDetails('#123ABC'), { hex: '#123ABC', rgb: [18, 58, 188], decimal: 0x123abc });
});

test('GitHub lookup parser only accepts public user and repository targets', () => {
  assert.deepEqual(parseGitHubTarget('torvalds'), { kind: 'user', path: '/users/torvalds', label: 'torvalds' });
  assert.equal(parseGitHubTarget('microsoft/vscode').path, '/repos/microsoft/vscode');
  assert.equal(parseGitHubTarget('https://github.com/microsoft/vscode.git').path, '/repos/microsoft/vscode');
  assert.equal(parseGitHubTarget('https://github.com.evil.test/user'), null);
  assert.equal(parseGitHubTarget('https://github.com@evil.test/user'), null);
  assert.equal(parseGitHubTarget('../secret'), null);
  assert.equal(parseGitHubTarget('owner/..'), null);
  assert.equal(parseGitHubTarget(''), null);
});

test('GitHub command calls only the public API and returns safe profile links', async () => {
  let requestedUrl;
  let card;
  await githubCommand.execute({
    client: { sendContainer: async (_laneId, payload) => { card = payload; } },
    message: { laneId: 'lane1', id: 'message1' },
    args: ['safe-user-lookup-test'],
    bot: { fetch: async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({ login: 'safe-user-lookup-test', name: 'Safe User', public_repos: 3, followers: 2, created_at: '2020-01-01T00:00:00Z', html_url: 'https://evil.example/redirect' }), { status: 200 });
    } },
  });
  assert.equal(requestedUrl, 'https://api.github.com/users/safe-user-lookup-test');
  assert.ok(card.linkButtons[0].url.startsWith('https://github.com/'));
});

test('GitHub command reports public API rate limits and network timeouts', async () => {
  const replies = [];
  const client = { sendContainer: async (_laneId, payload) => { replies.push(payload); } };
  const message = { laneId: 'lane1', id: 'message1' };
  await githubCommand.execute({
    client, message, args: ['unique-rate-limit-test'],
    bot: { fetch: async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }) },
  });
  assert.equal(replies[0].title, 'GitHub lookup failed');
  assert.match(replies[0].description, /rate limit/i);
  await githubCommand.execute({
    client, message, args: ['unique-timeout-test'],
    bot: { fetch: async () => { const error = new Error('request timed out'); error.name = 'TimeoutError'; throw error; } },
  });
  assert.equal(replies[1].title, 'GitHub lookup failed');
  assert.match(replies[1].description, /too long to respond/i);
});

test('Wikipedia search bounds queries and renders a result from the fixed Wikimedia API', async () => {
  assert.equal(parseWikipediaQuery('  northern   lights '), 'northern lights');
  assert.equal(parseWikipediaQuery('x'.repeat(121)), null);
  let requestedUrl;
  let requestHeaders;
  let card;
  await wikipediaCommand.execute({
    client: { sendContainer: async (_laneId, payload) => { card = payload; } },
    message: { laneId: 'lane1', id: 'message1' },
    args: ['northern', 'lights'],
    bot: { fetch: async (url, options) => {
      requestedUrl = new URL(String(url));
      requestHeaders = options.headers;
      return new Response(JSON.stringify({ pages: [{ title: 'Aurora', key: 'Aurora', description: 'Natural light display', excerpt: '<span class="searchmatch">Aurora</span> in the sky.' }] }), { status: 200 });
    } },
  });
  assert.equal(requestedUrl.origin, 'https://en.wikipedia.org');
  assert.equal(requestedUrl.pathname, '/w/rest.php/v1/search/page');
  assert.equal(requestedUrl.searchParams.get('q'), 'northern lights');
  assert.match(requestHeaders['User-Agent'], /^VeiledBot\//);
  assert.equal(card.title, 'Aurora');
  assert.match(card.description, /Aurora in the sky/);
  assert.equal(card.linkButtons[0].url, 'https://en.wikipedia.org/wiki/Aurora');
});

test('Wikipedia search handles empty results and upstream rate limiting', async () => {
  const replies = [];
  const client = { sendContainer: async (_laneId, payload) => { replies.push(payload); } };
  const message = { laneId: 'lane1', id: 'message1' };
  await wikipediaCommand.execute({ client, message, args: ['no-result-unique-test'], bot: { fetch: async () => new Response(JSON.stringify({ pages: [] }), { status: 200 }) } });
  assert.equal(replies[0].title, 'No article found');
  await wikipediaCommand.execute({ client, message, args: ['rate-limit-unique-test'], bot: { fetch: async () => new Response('{}', { status: 429 }) } });
  assert.equal(replies[1].title, 'Wikipedia search failed');
  assert.match(replies[1].description, /too many requests/i);
});

test('rock-paper-scissors resolves all outcomes and validates user input', () => {
  assert.deepEqual(playRound('rock', 2), { player: 'rock', opponent: 'scissors', outcome: 'win' });
  assert.deepEqual(playRound('paper', 2), { player: 'paper', opponent: 'scissors', outcome: 'loss' });
  assert.deepEqual(playRound('scissors', 2), { player: 'scissors', opponent: 'scissors', outcome: 'tie' });
  assert.equal(playRound('lizard', 0), null);
  assert.throws(() => playRound('rock', 3), RangeError);
});

test('all command modules load with unique names and aliases', async () => {
  const bot = new Bot();
  const count = await bot.loadCommands();
  assert.ok(count >= 20, `expected 20+ commands, got ${count}`);
  assert.ok(bot.commands.has('help'));
  assert.ok(bot.commands.has('roominfo'));
  assert.ok(bot.commands.has('roll'));
  assert.ok(bot.commands.has('timezone'));
  assert.ok(bot.commands.has('palette'));
  assert.ok(bot.commands.has('github'));
  assert.ok(bot.commands.has('wikipedia'));
  assert.ok(bot.commands.has('rps'));
  assert.ok(bot.commands.has('invites'));
  assert.ok(bot.commands.has('revokeinvite'));
  assert.ok(bot.commands.has('events'));
  assert.ok(bot.commands.has('eventcreate'));
  assert.ok(bot.commands.has('eventrsvp'));
  assert.ok(bot.commands.has('thread'));
  assert.ok(bot.commands.has('moderate'));
  assert.ok(bot.commands.has('roleconfig'));
  assert.ok(bot.commands.has('eventupdate'));
  assert.ok(bot.commands.has('eventcancel'));
  assert.ok(bot.commands.has('webhooks'));
  assert.ok(bot.commands.has('perms'));
  assert.ok(bot.commands.has('selfprefix'));

  // Removed commands must not exist
  for (const removed of ['calc', 'base64', 'delete', 'echo', 'edit', 'hash', 'reverse', 'textstats', 'typing', 'timestamp', 'threadmembers']) {
    assert.equal(bot.commands.has(removed), false, `${removed} should be removed`);
  }

  // Required aliases
  assert.equal(bot.aliases.get('av'), 'avatar');
  assert.equal(bot.aliases.get('a'), 'afk');
  assert.equal(bot.aliases.get('bi'), 'botinfo');
  assert.equal(bot.aliases.get('vi'), 'voiceinfo');
  assert.equal(bot.aliases.get('tz'), 'timezone');
  assert.equal(bot.aliases.get('ri'), 'roominfo');
  assert.equal(bot.aliases.get('ec'), 'eventcreate');
  assert.equal(bot.aliases.get('ecr'), 'eventcreate');
  assert.equal(bot.aliases.get('eca'), 'eventcancel');
  assert.equal(bot.aliases.get('evrsvp'), 'eventrsvp');
  assert.equal(bot.aliases.get('evu'), 'eventupdate');
  assert.equal(bot.aliases.get('git'), 'github');
  assert.equal(bot.aliases.get('li'), 'laneinfo');
  assert.equal(bot.aliases.get('mod'), 'moderate');
  assert.equal(bot.aliases.get('rem'), 'remind');
  assert.equal(bot.aliases.get('remc'), 'remindcancel');
  assert.equal(bot.aliases.get('revi'), 'revokeinvite');
  assert.equal(bot.aliases.get('rolec'), 'roleconfig');

  const utilityCount = [...bot.commands.values()].filter((command) => command.category === 'utility').length;
  const helpText = Array.from({ length: Math.ceil(utilityCount / 6) }, (_, page) => createHelpComponents(bot, 'utility', '!', page))
    .flatMap((roots) => roots.flatMap((root) => root.components))
    .filter((component) => component.type === 10)
    .map((component) => component.content)
    .join(' ');
  assert.ok(helpText.includes('**!afk**'));
  const roomCount = [...bot.commands.values()].filter((command) => command.category === 'rooms').length;
  const roomHelp = Array.from({ length: Math.ceil(roomCount / 6) }, (_, page) => createHelpComponents(bot, 'rooms', '!', page))
    .flatMap((roots) => roots.flatMap((root) => root.components))
    .filter((component) => component.type === 10)
    .map((component) => component.content)
    .join(' ');
  assert.ok(roomHelp.includes('**!voiceinfo**'));
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

test('message pins and allowlisted voice-state/join/leave routes use the current Bot API shapes', async () => {
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

test('room roles and invites use supported Bot API routes', async () => {
  const requests = [];
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (url, options) => {
    requests.push({ path: new URL(String(url)).pathname, method: options.method, body: options.body, headers: options.headers });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await client.getRoomRoles('room1');
  await client.getMemberRoles('room1', 'user1');
  await client.getLaneCapabilities('lane1');
  await client.createInvite('room1', { maxAge: 3600 }, 'invite-request-1');
  await client.getInvite('invite-code');
  await client.getRoomInvites('room1');
  await client.revokeInvite('invite-code');
  assert.deepEqual(requests.map(({ path, method }) => [path, method]), [
    ['/api/v1/rooms/room1/roles', 'GET'],
    ['/api/v1/rooms/room1/members/user1/roles', 'GET'],
    ['/api/v1/lanes/lane1/capabilities', 'GET'],
    ['/api/v1/rooms/room1/invites', 'POST'],
    ['/api/v1/invites/invite-code', 'GET'],
    ['/api/v1/rooms/room1/invites', 'GET'],
    ['/api/v1/invites/invite-code', 'DELETE'],
  ]);
  assert.equal(JSON.parse(requests[3].body).maxAge, 3600);
  assert.equal(requests[3].headers.get('Idempotency-Key'), 'invite-request-1');
});

test('thread and scheduled-event methods use supported Bot API route shapes', async () => {
  const requests = [];
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (url, options) => {
    requests.push({ path: new URL(String(url)).pathname, method: options.method, body: options.body });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await client.getLaneThreads('lane1', 'limit=20');
  await client.getThread('thread1');
  await client.getThreadMessages('thread1', 'limit=10');
  await client.getThreadMembers('thread1');
  await client.addThreadMember('thread1', 'user1');
  await client.removeThreadMember('thread1', 'user1');
  await client.sendThreadMessage('thread1', 'hello');
  await client.getScheduledEvents('room1', 'limit=10');
  await client.getScheduledEvent('event1');
  await client.createScheduledEvent('room1', { name: 'Release', laneId: 'lane1' });
  await client.setEventRsvp('event1', 'GOING');
  await client.removeEventRsvp('event1');
  assert.deepEqual(requests.map(({ path, method }) => [path, method]), [
    ['/api/v1/lanes/lane1/threads', 'GET'],
    ['/api/v1/threads/thread1', 'GET'],
    ['/api/v1/threads/thread1/messages', 'GET'],
    ['/api/v1/threads/thread1/members', 'GET'],
    ['/api/v1/threads/thread1/members', 'POST'],
    ['/api/v1/threads/thread1/members/user1', 'DELETE'],
    ['/api/v1/threads/thread1/messages', 'POST'],
    ['/api/v1/rooms/room1/events', 'GET'],
    ['/api/v1/events/event1', 'GET'],
    ['/api/v1/rooms/room1/events', 'POST'],
    ['/api/v1/events/event1/rsvp', 'PUT'],
    ['/api/v1/events/event1/rsvp', 'DELETE'],
  ]);
  assert.deepEqual(JSON.parse(requests[4].body), { userId: 'user1' });
  assert.deepEqual(JSON.parse(requests[6].body), { content: 'hello' });
  assert.deepEqual(JSON.parse(requests[10].body), { status: 'GOING' });
});

test('thread archive and lock helpers use bot-allowlisted routes', async () => {
  const requests = [];
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (url, options) => {
    requests.push([new URL(String(url)).pathname, options.method]);
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await client.archiveThread('thread1');
  await client.unarchiveThread('thread1');
  await client.lockThread('thread1');
  await client.unlockThread('thread1');
  await client.updateThread('thread1', { name: 'Updated title' });
  await client.pinThread('thread1');
  await client.publishThread('thread1');
  await client.deleteThread('thread1');
  assert.deepEqual(requests, [
    ['/api/v1/threads/thread1/archive', 'POST'],
    ['/api/v1/threads/thread1/unarchive', 'POST'],
    ['/api/v1/threads/thread1/lock', 'POST'],
    ['/api/v1/threads/thread1/unlock', 'POST'],
    ['/api/v1/threads/thread1', 'PATCH'],
    ['/api/v1/threads/thread1/pin', 'POST'],
    ['/api/v1/threads/thread1/publish', 'POST'],
    ['/api/v1/threads/thread1', 'DELETE'],
  ]);
});

test('remaining invite, event, thread-create, and command-interaction wrappers use bot-allowlisted routes', async () => {
  const requests = [];
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (url, options) => {
    requests.push({ url: new URL(String(url)), method: options.method, body: options.body });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await client.updateInvite('invite-code', { maxAge: 3600 });
  await client.updateScheduledEvent('event1', { name: 'New title' }, 'SERIES');
  await client.cancelScheduledEvent('event1', 'OCCURRENCE');
  await client.createThread('lane1', { name: 'Bug report', starterMessageId: 'message1' });
  await client.respondToCommandInteraction('interaction1', { type: 'modal' });
  assert.deepEqual(requests.map(({ url, method }) => [url.pathname, url.search, method]), [
    ['/api/v1/invites/invite-code', '', 'PATCH'],
    ['/api/v1/events/event1', '?scope=SERIES', 'PATCH'],
    ['/api/v1/events/event1', '?scope=OCCURRENCE', 'DELETE'],
    ['/api/v1/lanes/lane1/threads', '', 'POST'],
    ['/api/v1/interactions/commands/interaction1/callback', '', 'POST'],
  ]);
  assert.deepEqual(JSON.parse(requests[3].body), { name: 'Bug report', starterMessageId: 'message1' });
});

test('event creation parser validates schedule, type, timezone, and external location', () => {
  const now = Date.parse('2026-10-01T00:00:00.000Z');
  const valid = parseEventInput('lane_123 | Product update | VOICE | 2026-10-02T18:00:00-04:00 | Join us', now);
  assert.deepEqual(valid, {
    laneId: 'lane_123', name: 'Product update', description: 'Join us', locationType: 'VOICE',
    externalLocation: null, scheduledStartAt: '2026-10-02T22:00:00.000Z', timezone: 'UTC',
  });
  assert.equal(parseEventInput('lane_123 | Bad | EXTERNAL | 2026-10-02T18:00:00Z', now), null);
  assert.equal(parseEventInput('lane_123 | Bad | VOICE | 2026-09-30T18:00:00Z', now), null);
  assert.equal(parseEventInput('lane_123 | Bad | UNKNOWN | 2026-10-02T18:00:00Z', now), null);
  assert.equal(parseEventInput('lane_123 | External | EXTERNAL | 2026-10-02T18:00:00Z | desc | https://example.test', now)?.externalLocation, 'https://example.test');
});

test('invite command validates revoke codes and lists safe links', async () => {
  assert.equal(isInviteCode('safe-code_123'), true);
  assert.equal(isInviteCode('../other'), false);
  let card;
  await invitesCommand.execute({
    bot: { getLaneInfo: async () => ({ roomId: 'room1' }) },
    client: { getRoomInvites: async () => ({ invites: [{ code: 'safe-code', expiresAt: null }] }), sendContainer: async (_laneId, value) => { card = value; } },
    message: { laneId: 'lane1', id: 'message1' },
  });
  assert.match(card.description, /https:\/\/veiled\.lol\/invite\/safe-code/);
  let revoked;
  await revokeInviteCommand.execute({ client: { revokeInvite: async (code) => { revoked = code; }, sendContainer: async () => {} }, message: { laneId: 'lane1', id: 'message1' }, args: ['safe-code'] });
  assert.equal(revoked, 'safe-code');
});

test('event and thread operational commands call only supported API methods', async () => {
  const calls = [];
  const client = {
    getScheduledEvents: async (roomId, query) => { calls.push(['events', roomId, query]); return { events: [{ name: 'Roadmap', scheduledStartAt: '2026-10-30T16:00:00Z', locationType: 'VOICE', rsvpCount: 3 }] }; },
    createScheduledEvent: async (roomId, payload) => { calls.push(['createEvent', roomId, payload]); return { event: { id: 'event1', ...payload } }; },
    setEventRsvp: async (eventId, status) => { calls.push(['rsvp', eventId, status]); },
    archiveThread: async (threadId) => { calls.push(['archive', threadId]); },
    sendContainer: async (_laneId, card) => { calls.push(['card', card]); },
  };
  const message = { laneId: 'lane1', id: 'message1' };
  await eventsCommand.execute({ bot: { getLaneInfo: async () => ({ roomId: 'room1' }) }, client, message });
  assert.equal(calls[0][0], 'events');
  assert.match(calls[1][1].description, /Roadmap/);
  await eventCreateCommand.execute({ bot: { getLaneInfo: async () => ({ roomId: 'room1' }) }, client, message, rawArgs: 'lane_123 | Release | STAGE | 2026-12-01T20:00:00Z' });
  assert.equal(calls[2][0], 'createEvent');
  assert.equal(calls[2][1], 'room1');
  await eventRsvpCommand.execute({ client, message, args: ['event_123', 'going'] });
  assert.deepEqual(calls[4], ['rsvp', 'event_123', 'GOING']);
  await threadStateCommand.execute({ client, message, args: ['archive', 'thread_123'] });
  assert.deepEqual(calls[6], ['archive', 'thread_123']);
});

test('avatar, roominfo, thread edit, moderate shorthand, react auto-reactions, history, card builder, and ownerOnly work properly', async () => {
  const sent = [];
  const client = {
    getMembers: async () => ({
      members: [{ userId: 'u1', nickname: 'Malice', User: { id: 'u1', username: 'malice', avatar: 'https://cdn.veiled.lol/avatars/u1.png' } }],
    }),
    getRoom: async () => ({
      room: { id: 'r1', name: 'Veiled HQ', icon: 'https://cdn.veiled.lol/icons/r1.png', banner: 'https://cdn.veiled.lol/banners/r1.png' },
    }),
    getLaneThreads: async () => ({ threads: [{ id: 'thread_123', name: 'General Thread', isArchived: false, isLocked: false }] }),
    getThread: async (id) => ({ thread: { id, name: 'General Thread', isArchived: false, isLocked: false } }),
    kickMember: async (...args) => sent.push(['kick', ...args]),
    getMessages: async () => ({
      messages: Array.from({ length: 7 }, (_, i) => ({
        id: `m${i + 1}`,
        content: `Hello message ${i + 1}`,
        createdAt: '2026-10-31T20:00:00Z',
        author: { username: 'user1' },
      })),
    }),
    sendContainer: async (_laneId, card) => { sent.push(['card', card]); },
  };
  const bot = {
    ownerId: 'owner_1',
    getLaneInfo: async () => ({ roomId: 'r1', roomName: 'Veiled HQ' }),
    prefixes: { get: () => null, set: () => {}, clear: () => {} },
    timezones: { get: () => null, set: () => {} },
    autoreact: {
      rules: [],
      list() { return this.rules; },
      add(entry) { const item = { id: 'ar1', ...entry }; this.rules.push(item); return item; },
    },
    cardDrafts: new Map(),
  };

  // 1. Avatar embeds image inside container
  await avatarCommand.execute({ bot, client, message: { laneId: 'l1', id: 'm1', author: { id: 'u1' } }, args: [] });
  const avatarCard = sent.at(-1)[1];
  assert.equal(avatarCard.images[0].url, 'https://cdn.veiled.lol/avatars/u1.png');

  // 2. Roominfo pulls room icon and banner into container
  await roomInfoCommand.execute({ bot, client, message: { laneId: 'l1', id: 'm1' } });
  const roomCard = sent.at(-1)[1];
  assert.equal(roomCard.images.length, 2);
  assert.equal(roomCard.images[0].url, 'https://cdn.veiled.lol/icons/r1.png');
  assert.equal(roomCard.images[1].url, 'https://cdn.veiled.lol/banners/r1.png');

  // 3. Rooms and roomstats enforce bot owner only
  await roomsCommand.execute({ bot, client, message: { laneId: 'l1', id: 'm1', author: { id: 'not_owner' } } });
  assert.equal(sent.at(-1)[1].title, 'Bot owner only');
  await roomStatsCommand.execute({ bot, client, message: { laneId: 'l1', id: 'm1', author: { id: 'not_owner' } } });
  assert.equal(sent.at(-1)[1].title, 'Bot owner only');

  // 4. Thread edit interactive container
  await threadStateCommand.execute({ client, message: { laneId: 'l1', id: 'm1' }, args: ['edit', 'thread_123'] });
  const threadCard = sent.at(-1)[1];
  assert.ok(threadCard.actionRows.some((row) => row.components.some((c) => c.custom_id === 'veiledbot:thread:archive:thread_123')));

  // 5. Moderate shorthand + username lookup
  await moderateCommand.execute({ bot, client, message: { laneId: 'l1', id: 'm1' }, args: ['k', 'malice', 'rule', 'violation'] });
  assert.deepEqual(sent.find((item) => item[0] === 'kick'), ['kick', 'r1', 'u1', 'rule violation']);

  // 6. Auto-reaction requires quotes for phrases and accepts single words
  assert.ok(parseAutoReactAdd('add sentence without quotes 🔥').error);
  assert.deepEqual(parseAutoReactAdd('add "sentence here" 🔥'), { trigger: 'sentence here', isPhrase: true, emoji: '🔥' });
  assert.deepEqual(parseAutoReactAdd('add hello 👋'), { trigger: 'hello', isPhrase: false, emoji: '👋' });
  await reactCommand.execute({ bot, client, message: { laneId: 'l1', roomId: 'r1', id: 'm1', author: { id: 'u1' } }, args: ['add', 'sentence here', '🔥'], rawArgs: 'add "sentence here" 🔥' });
  assert.match(sent.at(-1)[1].description, /phrase \*\*"sentence here"\*\*/);

  // 7. History pagination
  await historyCommand.execute({ client, message: { laneId: 'l1', id: 'm1' }, args: ['2'] });
  const historyCard = sent.at(-1)[1];
  assert.match(historyCard.description, /Page 2 of 2/);
  assert.ok(historyCard.actionRows[0].components.every((c) => c.custom_id));

  // 8. Timezone interactive region selector
  await timezoneCommand.execute({ bot, client, message: { laneId: 'l1', id: 'm1', author: { id: 'u1' } }, args: [] });
  const tzCard = sent.at(-1)[1];
  assert.equal(tzCard.actionRows[0].components[0].custom_id, 'veiledbot:tz:region');
  assert.equal(tzCard.actionRows[1].components[0].custom_id, 'veiledbot:tz:zone');

  // 9. Card builder studio and selfprefix
  await cardCommand.execute({ bot, client, message: { laneId: 'l1', id: 'm1', author: { id: 'u1' } }, args: [], rawArgs: '' });
  const builderCard = sent.at(-1)[1];
  assert.equal(builderCard.actionRows.length, 3);
  await selfPrefixCommand.execute({ bot, client, message: { laneId: 'l1', id: 'm1', author: { id: 'u1' } }, args: ['?'] });
  assert.equal(sent.at(-1)[1].title, 'Personal prefix saved');
});

test('role and moderation wrappers use bot-allowlisted routes and server-owned permission checks', async () => {
  const requests = [];
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (url, options) => {
    requests.push({ path: new URL(String(url)).pathname, method: options.method, body: options.body });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await client.createRole('room1', { name: 'Helpers' });
  await client.assignRole('room1', 'user1', 'role1');
  await client.removeRole('room1', 'user1', 'role1');
  await client.reorderRoles('room1', [{ roleId: 'role1', position: 2 }]);
  await client.updateRole('role1', { name: 'Helpers+' });
  await client.deleteRole('role1');
  await client.kickMember('room1', 'user1', 'spam');
  await client.banMember('room1', 'user1', { reason: 'spam' });
  await client.unbanMember('room1', 'user1');
  await client.timeoutMember('room1', 'user1', 600, 'cool off');
  await client.removeMemberTimeout('room1', 'user1');
  assert.deepEqual(requests.map(({ path, method }) => [path, method]), [
    ['/api/v1/rooms/room1/roles', 'POST'],
    ['/api/v1/rooms/room1/members/user1/roles/role1', 'PUT'],
    ['/api/v1/rooms/room1/members/user1/roles/role1', 'DELETE'],
    ['/api/v1/rooms/room1/roles/reorder', 'PUT'],
    ['/api/v1/roles/role1', 'PATCH'],
    ['/api/v1/roles/role1', 'DELETE'],
    ['/api/v1/rooms/room1/members/user1', 'DELETE'],
    ['/api/v1/rooms/room1/bans/user1', 'PUT'],
    ['/api/v1/rooms/room1/bans/user1', 'DELETE'],
    ['/api/v1/rooms/room1/timeouts', 'POST'],
    ['/api/v1/rooms/room1/timeouts/user1', 'DELETE'],
  ]);
  assert.deepEqual(JSON.parse(requests[2].body || '{}'), {});
  assert.deepEqual(JSON.parse(requests[6].body), { reason: 'spam' });
  assert.deepEqual(JSON.parse(requests[9].body), { userId: 'user1', duration: 600, reason: 'cool off' });
});

test('moderation command rejects invalid timeout lengths and delegates enforcement to Veiled', async () => {
  assert.equal(parseTimeoutDuration('1m'), 60);
  assert.equal(parseTimeoutDuration('28d'), 2_419_200);
  assert.equal(parseTimeoutDuration('59s'), null);
  assert.equal(parseTimeoutDuration('29d'), null);
  let call;
  await moderateCommand.execute({
    bot: { getLaneInfo: async () => ({ roomId: 'room1' }) },
    client: { timeoutMember: async (...args) => { call = args; }, sendContainer: async () => {} },
    message: { laneId: 'lane1', id: 'message1' }, args: ['timeout', 'user_123', '2h', 'repeat', 'spam'],
  });
  assert.deepEqual(call, ['room1', 'user_123', 7200, 'repeat spam']);
});

test('role command supports real room role actions and confirms deletes', async () => {
  const calls = [];
  const context = {
    bot: { getLaneInfo: async () => ({ roomId: 'room1' }) },
    client: {
      createRole: async (...args) => { calls.push(['create', ...args]); return { role: { id: 'role_123', name: 'Helpers' } }; },
      assignRole: async (...args) => calls.push(['assign', ...args]),
      deleteRole: async (...args) => calls.push(['delete', ...args]),
      sendContainer: async (_laneId, value) => calls.push(['card', value]),
    },
    message: { laneId: 'lane1', id: 'message1' },
  };
  await roleOpsCommand.execute({ ...context, args: ['create', 'Helpers'], rawArgs: 'create Helpers' });
  assert.deepEqual(calls[0], ['create', 'room1', { name: 'Helpers' }]);
  await roleOpsCommand.execute({ ...context, args: ['assign', 'user_123', 'role_123'], rawArgs: 'assign user_123 role_123' });
  assert.deepEqual(calls[2], ['assign', 'room1', 'user_123', 'role_123']);
  await roleOpsCommand.execute({ ...context, args: ['delete', 'role_123'], rawArgs: 'delete role_123' });
  assert.match(calls.at(-1)[1].description, /confirm/);
});

test('event update and cancellation validate identifiers and use explicit recurring scope', async () => {
  const parsed = parseEventUpdate('event_123 | Release call | 2026-12-01T20:00:00-05:00 | America/New_York');
  assert.equal(parsed.eventId, 'event_123');
  assert.equal(parsed.payload.scheduledStartAt, '2026-12-02T01:00:00.000Z');
  assert.equal(parseEventUpdate('event_123 | Bad | tomorrow'), null);
  const calls = [];
  const client = {
    updateScheduledEvent: async (...args) => { calls.push(['update', ...args]); return { event: { name: 'Release call' } }; },
    cancelScheduledEvent: async (...args) => { calls.push(['cancel', ...args]); return { cancelledOccurrenceCount: 4 }; },
    sendContainer: async (_laneId, card) => calls.push(['card', card]),
  };
  const message = { laneId: 'lane1', id: 'message1' };
  await eventUpdateCommand.execute({ client, message, rawArgs: 'event_123 | Release call | 2026-12-01T20:00:00Z' });
  assert.equal(calls[0][0], 'update');
  await eventCancelCommand.execute({ client, message, args: ['event_123', 'series'] });
  assert.deepEqual(calls[2], ['cancel', 'event_123', 'SERIES']);
  assert.match(calls[3][1].description, /4 occurrence/);
});

test('webhook wrappers cover CRUD and token rotation while command output omits credentials', async () => {
  const requests = [];
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (url, options) => {
    requests.push({ path: new URL(String(url)).pathname, method: options.method, body: options.body });
    return new Response(JSON.stringify({ webhooks: [{ id: 'hook_123', name: 'Notify' }], webhookUrl: 'SECRET_TOKEN_URL' }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  await client.getLaneWebhooks('lane1');
  await client.getWebhook('hook_123');
  await client.createWebhook('lane1', { name: 'Notify' });
  await client.updateWebhook('hook_123', { name: 'New name' });
  await client.resetWebhookToken('hook_123');
  await client.deleteWebhook('hook_123');
  assert.deepEqual(requests.map(({ path, method }) => [path, method]), [
    ['/api/v1/lanes/lane1/webhooks', 'GET'], ['/api/v1/webhooks/hook_123', 'GET'],
    ['/api/v1/lanes/lane1/webhooks', 'POST'], ['/api/v1/webhooks/hook_123', 'PATCH'],
    ['/api/v1/webhooks/hook_123/token', 'POST'], ['/api/v1/webhooks/hook_123', 'DELETE'],
  ]);
  let card;
  await webhooksCommand.execute({ client: { getLaneWebhooks: async () => ({ webhooks: [{ id: 'hook_123', name: 'Notify', webhookUrl: 'SECRET_TOKEN_URL' }] }), sendContainer: async (_laneId, value) => { card = value; } }, message: { laneId: 'lane1', id: 'message1' }, args: ['list'] });
  assert.doesNotMatch(JSON.stringify(card), /SECRET_TOKEN_URL/);
});

test('native poll helper serializes a server-supported poll and enforces schema limits', async () => {
  let payload;
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } });
  });
  await client.createPoll('lane1', { question: 'Favorite?', options: ['A', 'B'], durationHours: 24, replyToId: 'message_123' });
  assert.equal(payload.replyToId, 'message_123');
  const pollData = JSON.parse(payload.content.slice('[POLL_DATA]'.length));
  assert.deepEqual(pollData.options, ['A', 'B']);
  assert.equal(pollData.durationHours, 24);
  assert.throws(() => client.createPoll('lane1', { question: 'q', options: ['only one'] }), /2–10 options/);
  let card;
  await pollCommand.execute({ client: { createPoll: async (_laneId, value) => { card = value; }, sendContainer: async (_laneId, value) => { card = value; } }, message: { laneId: 'lane1', id: 'message1' }, rawArgs: 'Choose | A | B' });
  assert.deepEqual(card.options, ['A', 'B']);
});

test('lane capabilities command displays returned permissions and limits', async () => {
  let card;
  await capabilitiesCommand.execute({
    client: { getLaneCapabilities: async () => ({ capabilities: { sendMessages: true, manageMessages: false }, slowmode: 5, characterLimit: 4000 }), sendContainer: async (_laneId, value) => { card = value; } },
    message: { laneId: 'lane1', id: 'message1' },
  });
  assert.match(card.description, /Send messages/);
  assert.match(card.description, /Manage messages/);
  assert.match(card.description, /Slowmode: 5s/);
  assert.match(card.description, /Character limit: 4000/);
});

test('highlight store and command support add, configure, list, edit, prioritize, and delete', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { HighlightStore } = await import('../src/state.js');
  const dir = mkdtempSync(join(tmpdir(), 'veiledbot-highlights-'));
  try {
    const store = new HighlightStore(dir);
    store.load();
    const sent = [];
    const client = { sendContainer: async (_laneId, card) => { sent.push(card); } };
    const bot = { highlights: store, getLaneInfo: async () => ({ roomId: 'room1', roomName: 'General' }) };
    const message = { laneId: 'lane1', roomId: 'room1', id: 'm1', author: { id: 'u1' } };

    // add
    await highlightCommand.execute({ bot, client, message, args: ['add', 'veiled'], rawArgs: 'add veiled', prefix: ',' });
    assert.equal(sent.at(-1).title, 'Highlight added');

    // configure (bulk add)
    assert.deepEqual(parseHighlightBulkInput('alpha, "beta gamma" | delta'), ['alpha', 'beta gamma', 'delta']);
    await highlightCommand.execute({ bot, client, message, args: ['configure'], rawArgs: 'configure alpha, "beta gamma" | delta', prefix: ',' });
    assert.equal(sent.at(-1).title, 'Highlights configured');
    assert.equal(store.list('u1', 'room1').length, 4);

    // edit
    await highlightCommand.execute({ bot, client, message, args: ['edit', '2', '|', 'omega'], rawArgs: 'edit 2 | omega', prefix: ',' });
    assert.equal(sent.at(-1).title, 'Highlight updated');
    assert.equal(store.list('u1', 'room1')[1].trigger, 'omega');

    // prioritize
    await highlightCommand.execute({ bot, client, message, args: ['prioritize', '4'], rawArgs: 'prioritize 4', prefix: ',' });
    assert.match(sent.at(-1).title, /Highlight prioritized/);
    assert.equal(store.list('u1', 'room1')[0].trigger, 'delta');
    assert.equal(store.list('u1', 'room1')[0].prioritized, true);

    // list
    await highlightCommand.execute({ bot, client, message, args: ['list'], rawArgs: 'list', prefix: ',' });
    assert.match(sent.at(-1).description, /\*\*1\.\*\* ⭐ `delta`/);

    // delete
    await highlightCommand.execute({ bot, client, message, args: ['delete', '1'], rawArgs: 'delete 1', prefix: ',' });
    assert.equal(sent.at(-1).title, 'Highlight deleted');
    assert.equal(store.list('u1', 'room1').length, 3);

    // persistence across reload
    const reloaded = new HighlightStore(dir);
    reloaded.load();
    assert.equal(reloaded.list('u1', 'room1').length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('VeiledClient sendDmContainer opens a DM lane and sends a CV2 container', async () => {
  const requests = [];
  const client = new VeiledClient('token', 'https://api.example.test/api/v1', async (url, options) => {
    const path = new URL(String(url)).pathname;
    requests.push({ path, method: options.method, body: JSON.parse(options.body) });
    if (path === '/api/v1/dms') {
      return new Response(JSON.stringify({ channel: { id: 'dm-msg-1' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ id: 'dm-msg-1' }), { status: 201, headers: { 'content-type': 'application/json' } });
  });

  await client.sendDmContainer('user-99', { title: 'Highlight', description: 'Hello' });
  assert.deepEqual(requests.map((r) => [r.path, r.method]), [
    ['/api/v1/dms', 'POST'],
    ['/api/v1/dms/dm-msg-1/messages', 'POST'],
  ]);
  assert.equal(requests[1].body.components[0].type, 17);
});

test('forward command preserves the source message as a native forward', async () => {
  let forwarded;
  await forwardCommand.execute({
    client: { forwardMessage: async (...args) => { forwarded = args; }, sendContainer: async () => {} },
    message: { laneId: 'lane-1', id: 'msg-2', replyToId: 'msg-1' },
    rawArgs: 'context for this message',
  });
  assert.deepEqual(forwarded, ['lane-1', 'msg-1', { kind: 'room', content: 'context for this message', replyToId: 'msg-2' }]);
});
