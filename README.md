# VeiledBot

VeiledBot is an open-source Node.js starter bot for Veiled. It connects to the Veiled Socket.IO gateway, uses the bot REST API, and sends its replies as Components V2 (CV2) container messages.

## Requirements

- Node.js 20 or newer
- A Veiled bot application and bot token
- The bot added to a room with the permissions needed for its commands (read lanes and members, read/send messages, add reactions)

## Quick start

```powershell
Copy-Item .env.example .env
```

Set `VEILED_BOT_TOKEN` in `.env`, then run:

```sh
npm install
npm start
```

Keep `.env` private. Never commit bot tokens or paste them into issue reports.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VEILED_BOT_TOKEN` | required | Bot token; an optional `Bot ` prefix is accepted |
| `VEILED_API_URL` | `https://api.veiled.lol/api/v1` | Veiled REST API base URL |
| `VEILED_GATEWAY_URL` | API discovery | Optional Socket.IO gateway URL override |
| `BOT_PREFIX` | `!` | Prefix for message commands; bot mentions also open help |

## Commands

Commands load automatically from `src/commands`. Replies use a CV2 container with a type-17 root and type-10 text displays.

### Utility

- `!help [category or command]` — interactive browser; lists every command by category
- `!ping` — API round-trip time and gateway state
- `!botinfo` — runtime, gateway, and command count
- `!userinfo [@member or user ID]` — profile, visible roles, nickname, and join date
- `!avatar [@member or username]` — member avatar and link
- `!afk [reason]` — persistent away state, mention notices, and auto-clear on return
- `!remind <duration> <text>` — persistent same-lane reminder, up to 30 days
- `!reminders` / `!remindcancel <id>` — list or cancel your reminders
- `!timestamp` — current UTC and Unix timestamps
- `!timezone <Area/City>` / `!tz` — current time in an IANA time zone, including daylight-saving rules
- `!calc <expression>` — safe arithmetic parser, no JavaScript execution
- `!color <#RRGGBB>` — inspect a hex color
- `!palette [random | theme]` — show five colors; themes include ocean, sunset, forest, pastel, neon, monochrome, warm, cool, earth, and candy
- `!github <username | owner/repo | URL>` — look up a public GitHub profile or repository. Uses GitHub’s unauthenticated API, so its public rate limit applies.
- `!hash <text>` — SHA-256 digest
- `!base64 <encode|decode> <text>` — UTF-8 Base64 utility
- `!reverse <text>` — reverse text
- `!textstats <text>` — character, word, line, and UTF-8 byte counts
- `!card <title> | <text>` — create a CV2 card
- `!echo <text>` — repeat text without triggering mentions
- `!typing` — send a typing event

### Fun

- `!coinflip` — heads or tails
- `!roll [NdS+modifier]` — dice notation such as `2d20+3`
- `!choose option 1 | option 2 | ...` — choose from 2–20 options
- `!8ball <question>` — playful yes-or-no answer
- `!rps <rock | paper | scissors>` — quick single-player round against the bot
- `!wikipedia <search terms>` / `!wiki` — find an English Wikipedia article with a short excerpt and link; requests use Wikimedia’s public API and include a five-second timeout

### Room and voice

- `!roominfo` — current room details
- `!roomstats` — summary of member and lane data returned by the API
- `!laneinfo` — current lane details
- `!lanes` — lanes in the current room
- `!members` — first page returned by the room members endpoint
- `!rooms` — rooms the bot has joined
- `!invite [1h | 1d | 7d | 30d | never]` — create a room invite if the bot has Create Instant Invite. Role grants are not added by this command.
- `!invites` — list active invites the bot can see in this room
- `!revokeinvite <invite code>` — revoke an invite when the bot has permission
- `!events` — list upcoming scheduled events visible to the bot
- `!eventcreate <lane ID> | <name> | <VOICE|STAGE|EXTERNAL> | <start ISO timestamp> | [description] | [external location] | [timezone]` — create an event if the bot has Create Events permission in the selected lane
- `!eventupdate <event ID> | <new name> | <start ISO timestamp> | [timezone]` — rename or reschedule an event the bot can manage
- `!eventcancel <event ID> [occurrence|series]` — cancel one occurrence or future recurring events
- `!eventrsvp <event ID> <interested|going>` — set the bot’s RSVP
- `!moderate <kick|ban|unban|timeout|untimeout> <user ID> [duration] [reason]` — moderate room members; timeout durations range from `1m` to `28d`
- `!roleops <create|rename|assign|remove|reorder|delete> ...` — manage room roles and member assignments with server-side permission and hierarchy checks
- `!threadstate <archive|unarchive|lock|unlock|pin|publish> <thread ID>` — manage a forum thread; deletion requires `!threadstate delete <thread ID> confirm`
- `!threadmembers <list|add|remove> <thread ID> [user ID]` — view and manage thread membership; added users must already be room members
- `!webhooks list|rename|delete ...` — inspect or manage lane webhooks. The bot does not print webhook secret URLs into public chat.

- `!voiceinfo` — current voice-lane participants and mute/deafen/video/stream status
- `!capabilities` — show this bot's permissions and lane limits

### Messages

- `!recent` — preview recent messages returned by the lane endpoint
- `!history` — count messages returned by the current lane history endpoint
- `!poll question | option 1 | option 2` — create a native poll with 2–10 choices (24-hour duration)
- `!pin` / `!unpin` — pin or unpin the message you replied to
- `!pins` — list pinned messages
- `!react [emoji]` — react to the invoking message
- `!edit [replacement text]` / `!delete` — demonstrate CV2 message edits and deletion
## CV2 examples

```js
await client.sendContainer(laneId, {
  title: 'Build finished',
  description: 'The bot sent this as a Components V2 container.',
  sections: [{ divider: true, content: 'Status: **ready**' }],
  footer: 'VeiledBot example',
  accentColor: 0x5865f2,
});
```

URL buttons are supported with `linkButtons: [{ label: 'Open site', url: 'https://example.com' }]`. The helper only permits HTTP/HTTPS URLs and creates link-style buttons. For interactive controls, create a component with a `custom_id`, handle `INTERACTION_CREATE`, and answer through `respondToInteraction`; see `src/commands/utility/help.js` and `src/events/interactionCreate.js` for a working select-menu example.

Attachments can be uploaded through `stageUpload()` and sent using `stagedUploadIds` with the message endpoint. Example:

```js
const upload = await client.stageUpload(fileBuffer, { filename: 'report.txt', contentType: 'text/plain' });
await client.sendMessage(laneId, {
  components: createContainer({ title: 'Report attached', description: 'See the uploaded file.' }),
  stagedUploadIds: [upload.id],
});
```

## What this starter supports

The SDK includes wrappers for the bot-allowlisted room, lane, message, poll, role, member-moderation, scheduled-event, invite, thread, upload, interaction, voice join/leave, and webhook routes. Management commands call those routes directly; Veiled remains responsible for endpoint permissions, applicable hierarchy checks, event ownership, and rate limits. The bot does not print webhook execution URLs in room messages because the URL contains a secret token.

The voice-state endpoint requires room membership and `VIEW_CHANNEL`; the capabilities endpoint checks `VIEW_CHANNEL` and reports the bot lane permissions and limits. The Bot API still does not allow user/message report submission, AutoMod rule management, antinuke, music playback, or Discord private-API compatibility. Polls use existing message and reaction routes; there is no separate poll-management endpoint. Message edits cannot add new attachments: the edit schema accepts content, embeds, components, and forum title, but not staged upload IDs. These are API gaps, so the starter does not advertise them as supported bot features.

`createWebhook()` and `resetWebhookToken()` return a `webhookUrl` containing a credential. Keep it in a secret store and never send it to a public lane, log it, or commit it. The `!webhooks` command lists, renames, or deletes webhooks without revealing URL tokens.

## Gateway events

Use `bot.onGateway(eventName, handler)` to subscribe to an event, and call the returned function to unsubscribe. Event names are checked against the set Veiled emits today. For example:

```js
const stopListening = bot.onGateway('MESSAGE_REACTION_ADD', (event) => {
  console.log(event.messageId, event.userId, event.emoji);
});
// Later, when the feature is disabled:
stopListening();
```

Message create/update/delete, reactions, typing, and voice roster changes are sent according to lane visibility. Room, lane, member, role, AutoMod-rule, raid, scheduled-event, and room-expression updates generally go to the room event channel; private lane creation is sent only to its actor. Join-request changes also notify the applicant directly. `BOT_ROOM_ADD` and `BOT_ROOM_REMOVE` go to the bot account; `INTERACTION_CREATE` is sent to one connected socket for the application. Payloads differ by event and action. Reconnects do not replay events, so use the REST API to resynchronize state after reconnecting.

The supported event names are `MESSAGE_CREATE`, `MESSAGE_UPDATE`, `MESSAGE_DELETE`, `MESSAGE_REACTION_ADD`, `MESSAGE_REACTION_REMOVE`, `TYPING_START`, `VOICE_ROSTER_UPDATE`, `LANE_CREATE`, `LANE_UPDATE`, `LANE_DELETE`, `LANE_REORDER`, `ROOM_UPDATE`, `ROOM_DELETE`, `ROOM_EXPRESSIONS_UPDATE`, `ROOM_JOIN_REQUEST_UPDATE`, `MEMBER_JOIN`, `MEMBER_LEAVE`, `MEMBER_BAN`, `MEMBER_UNBAN`, `MEMBER_TIMEOUT`, `MEMBER_ROLE_ADD`, `MEMBER_ROLE_REMOVE`, `ROLE_CREATE`, `ROLE_UPDATE`, `ROLE_DELETE`, `ROLE_POSITIONS_UPDATE`, `AUTOMOD_RULE_CREATE`, `AUTOMOD_RULE_UPDATE`, `AUTOMOD_RULE_DELETE`, `RAID_DETECTED`, `RAID_ENDED`, `SCHEDULED_EVENT_UPDATE`, `BOT_ROOM_ADD`, `BOT_ROOM_REMOVE`, and `INTERACTION_CREATE`.

Veiled does not currently emit bot events for presence changes, invite create/update/delete, thread lifecycle, webhook lifecycle, poll-specific actions, or slash-command registration and dispatch. Those are not silently mapped to Discord event names.

## Development and checks

```sh
npm test
npm run check
```

Tests use Node's built-in test runner and do not require a live Veiled account. Add new commands as one module with a unique `name`, optional `aliases`, and an `execute()` function. Use `client.sendContainer()` for standard replies.

## Porting notes

Some commands borrow ideas from SleeplessPY, then use Veiled’s message format and API. The ports include AFK, reminders, polls, room statistics, Wikipedia search, rock-paper-scissors, color palettes, and time-zone lookup. Operational moderation, role management, scheduled-event changes, invites, threads, webhooks, and native polls now call registered Bot API routes. Veiled remains responsible for permission checks, hierarchy, and rate limits.

AFK states and reminders are saved as JSON in `data/` on the machine hosting the bot; those files are ignored by Git. Reminders go back to the lane where they were created. If delivery fails, the bot retries and leaves the reminder available to cancel.

## License

MIT. See [LICENSE](LICENSE).
