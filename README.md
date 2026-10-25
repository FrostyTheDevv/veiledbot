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
- `!calc <expression>` — safe arithmetic parser, no JavaScript execution
- `!color <#RRGGBB>` — inspect a hex color
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

### Room and voice

- `!roominfo` — current room details
- `!roomstats` — summary of member and lane data returned by the API
- `!laneinfo` — current lane details
- `!lanes` — lanes in the current room
- `!members` — first page returned by the room members endpoint
- `!rooms` — rooms the bot has joined
- `!voiceinfo` — current voice-lane participants and mute/deafen/video/stream status

### Messages

- `!recent` — preview recent messages returned by the lane endpoint
- `!history` — count messages returned by the current lane history endpoint
- `!poll question | option 1 | option 2` — create a 2–5 choice reaction poll
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

The bot uses the routes enabled by Veiled's bot API: identity, joined rooms, gateway discovery, room/lane/member reads, message history, sending/editing/deleting messages, staged uploads, reactions, typing, room leave, and interaction callbacks.

It does not pretend to offer administrator actions that the bot API does not expose. In particular, room moderation, role/member management, automod/antinuke, music streaming, and Discord's private bot API compatibility are not implemented by this starter. Those require supported Veiled endpoints/services and, for Discord migration, a separately designed adapter. See the API allowlist in Veiled source when extending this project.

## Development and checks

```sh
npm test
npm run check
```

Tests use Node's built-in test runner and do not require a live Veiled account. Add new commands as one module with a unique `name`, optional `aliases`, and an `execute()` function. Use `client.sendContainer()` for standard replies.

## License

MIT. See [LICENSE](LICENSE).
## Porting notes

The practical features here reimplement ideas from SleeplessPY’s AFK, reminders, polls, room-statistics, and message-management cogs in JavaScript and Veiled CV2. Leo’s current bot example and route allowlist were also checked for supported routes. Moderation, role management, economy, and music playback are not stubbed because the current bot API does not provide those complete capabilities. `!voiceinfo` uses the new live voice-state endpoint; audio playback still needs a bot WebRTC/SFU media session and runtime dependencies.

AFK states and reminders are stored in `data/afk.json` and `data/reminders.json` on the machine hosting the bot. These files are ignored by Git. Reminders return to the lane where they were created. Failed delivery is retried with backoff, then left visible for cancellation.