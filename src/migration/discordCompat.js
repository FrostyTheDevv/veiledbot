const MESSAGE_KEYS = new Set([
  'content', 'embeds', 'components', 'flags', 'message_reference', 'thread_id', 'nonce', 'stagedUploadIds',
  'allowed_mentions', 'attachments', 'sticker_ids', 'poll', 'tts',
]);
const CV2_FLAG = 32768;
const EPHEMERAL_FLAG = 64;
const ID_PATTERN = /^[a-z0-9]{10,40}$/i;

export class UnsupportedDiscordOperationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedDiscordOperationError';
  }
}

function requireMethod(target, name) {
  if (typeof target?.[name] !== 'function') {
    throw new UnsupportedDiscordOperationError('This VeiledBot client does not provide ' + name + '().');
  }
  return target[name].bind(target);
}

function assertKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + ' must be an object.');
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new UnsupportedDiscordOperationError('Veiled does not translate ' + label + ' fields: ' + unknown.join(', ') + '.');
}

function serialize(value) {
  if (Array.isArray(value)) return value.map(serialize);
  if (!value || typeof value !== 'object') return value;
  if (typeof value.toJSON === 'function') return serialize(value.toJSON());
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
}

function hasCv2(value) {
  return Array.isArray(value) && value.some((component) =>
    component && typeof component === 'object' && [9, 10, 12, 13, 14, 17].includes(Number(component.type)));
}

function toMessage(payload = {}, { laneId, threadId, allowReply = false } = {}) {
  assertKeys(payload, [...MESSAGE_KEYS], 'Discord message');
  if (payload.allowed_mentions !== undefined) {
    throw new UnsupportedDiscordOperationError('Discord allowed_mentions has no direct Veiled equivalent; Veiled mention permissions and room policies apply.');
  }
  if (payload.attachments !== undefined) {
    throw new UnsupportedDiscordOperationError('Discord attachment objects cannot be reused. Upload each file to Veiled and pass stagedUploadIds.');
  }
  if (payload.sticker_ids?.length) {
    throw new UnsupportedDiscordOperationError('Discord sticker IDs are not Veiled sticker IDs; import the sticker into Veiled first.');
  }
  if (payload.poll !== undefined) {
    throw new UnsupportedDiscordOperationError('Discord poll payloads are not translated. Create a Veiled poll through the Veiled poll API.');
  }
  if (payload.tts) throw new UnsupportedDiscordOperationError('Discord TTS messages are not supported by this Veiled message API.');
  const flags = payload.flags ?? 0;
  if (!Number.isSafeInteger(flags) || flags < 0 || (flags & ~CV2_FLAG) !== 0) {
    throw new UnsupportedDiscordOperationError('Only the Components V2 message flag can be validated; Veiled derives the stored flag from the component tree.');
  }
  const components = payload.components === undefined ? undefined : serialize(payload.components);
  const componentsV2 = hasCv2(components);
  if ((flags & CV2_FLAG) && !componentsV2) {
    throw new UnsupportedDiscordOperationError('Components V2 flag requires a Veiled CV2 component layout in components.');
  }
  if (componentsV2 && (payload.content !== undefined || payload.embeds !== undefined)) {
    throw new UnsupportedDiscordOperationError('Components V2 messages cannot also include legacy content or embeds.');
  }
  if (payload.message_reference !== undefined && !allowReply) {
    throw new UnsupportedDiscordOperationError('Message references are only supported when creating a Veiled reply.');
  }
  let replyToId;
  if (payload.message_reference) {
    assertKeys(payload.message_reference, ['message_id', 'channel_id'], 'Discord message reference');
    replyToId = payload.message_reference.message_id;
    if (!replyToId) throw new TypeError('A Veiled reply requires message_reference.message_id.');
    const allowedChannelIds = new Set([laneId, threadId].filter(Boolean));
    if (payload.message_reference.channel_id && !allowedChannelIds.has(payload.message_reference.channel_id)) {
      throw new UnsupportedDiscordOperationError('message_reference.channel_id must match the target Veiled lane or thread.');
    }
  }
  if (payload.nonce !== undefined) {
    throw new UnsupportedDiscordOperationError('Discord nonces are not accepted by this adapter; Veiled uses its own UUID clientNonce.');
  }
  const message = {};
  if (payload.content !== undefined) message.content = payload.content;
  if (payload.embeds !== undefined) message.embeds = serialize(payload.embeds);
  if (components !== undefined) message.components = components;
  if (replyToId) message.replyToId = replyToId;
  if (payload.thread_id !== undefined) {
    if (!threadId || payload.thread_id !== threadId) throw new UnsupportedDiscordOperationError('thread_id must match the target thread channel; use createThreadMessage() to resolve and validate the parent lane.');
    message.threadId = threadId;
  }
  if (payload.stagedUploadIds !== undefined) {
    if (!Array.isArray(payload.stagedUploadIds) || payload.stagedUploadIds.length > 10 || payload.stagedUploadIds.some((id) => typeof id !== 'string' || !ID_PATTERN.test(id))) {
      throw new TypeError('stagedUploadIds must contain at most 10 valid Veiled staged upload IDs (10–40 letters or digits).');
    }
    message.stagedUploadIds = [...payload.stagedUploadIds];
  }
  return message;
}

function rolePayload(input, partial = false) {
  assertKeys(input, ['name', 'color', 'permissions', 'hoist', 'mentionable'], 'Discord role');
  if (input.permissions !== undefined) {
    throw new UnsupportedDiscordOperationError('Discord permission bitfields do not map safely to Veiled permission flags; set role permissions in Veiled.');
  }
  const body = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.color !== undefined) body.color = input.color;
  if (input.hoist !== undefined) body.hoist = input.hoist;
  if (input.mentionable !== undefined) body.isMentionable = input.mentionable;
  if (!partial && typeof body.name !== 'string') throw new TypeError('Creating a role requires name.');
  if (!Object.keys(body).length) throw new TypeError('Role update needs at least one supported field.');
  return body;
}

function scheduledEventPayload(input, partial = false) {
  assertKeys(input, ['name', 'description', 'channel_id', 'scheduled_start_time', 'scheduled_end_time', 'entity_type', 'entity_metadata'], 'Discord scheduled event');
  const body = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.channel_id !== undefined) body.laneId = input.channel_id;
  if (input.scheduled_start_time !== undefined) body.scheduledStartAt = input.scheduled_start_time;
  if (input.scheduled_end_time !== undefined) body.scheduledEndAt = input.scheduled_end_time;
  if (input.entity_type !== undefined) {
    const type = { 1: 'STAGE', 2: 'VOICE', 3: 'EXTERNAL' }[input.entity_type];
    if (!type) throw new UnsupportedDiscordOperationError('entity_type must be 1 (stage), 2 (voice), or 3 (external).');
    body.locationType = type;
  }
  if (input.entity_metadata !== undefined) {
    assertKeys(input.entity_metadata, ['location'], 'Discord event entity_metadata');
    if (input.entity_metadata.location !== undefined) body.externalLocation = input.entity_metadata.location;
  }
  if (!partial) {
    for (const key of ['name', 'laneId', 'scheduledStartAt', 'locationType']) {
      if (body[key] === undefined) throw new TypeError('Creating a scheduled event requires ' + key + '.');
    }
  } else if (!Object.keys(body).length) {
    throw new TypeError('Scheduled-event update needs at least one supported field.');
  }
  return body;
}

function invitePayload(input = {}, partial = false) {
  assertKeys(input, ['max_age', 'max_uses', 'temporary'], 'Discord invite');
  const body = {};
  if (input.max_age !== undefined) {
    if (!Number.isSafeInteger(input.max_age) || input.max_age < 0 || input.max_age > 2_592_000) {
      throw new TypeError('Discord max_age must be an integer number of seconds from 0 to 2,592,000.');
    }
    body.maxAge = input.max_age;
  }
  if (input.max_uses !== undefined) {
    if (!Number.isSafeInteger(input.max_uses) || input.max_uses < 0 || input.max_uses > 100) {
      throw new TypeError('Discord max_uses must be an integer from 0 to 100.');
    }
    body.maxUses = input.max_uses;
  }
  if (input.temporary !== undefined) {
    if (typeof input.temporary !== 'boolean') throw new TypeError('temporary must be a boolean.');
    body.temporary = input.temporary;
  }
  if (partial && !Object.keys(body).length) throw new TypeError('Invite update needs max_age, max_uses, or temporary.');
  return body;
}

function webhookPayload(input = {}, { partial = false } = {}) {
  if (input && typeof input === 'object' && Object.hasOwn(input, 'avatar')) {
    throw new UnsupportedDiscordOperationError('Discord webhook avatar bytes/base64 are not accepted. Upload an avatar through Veiled first, then pass its public avatar_url.');
  }
  assertKeys(input, ['name', 'avatar_url', 'channel_id'], 'Discord webhook');
  const body = {};
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 80) throw new TypeError('Webhook name must be 1–80 characters.');
    body.name = input.name.trim();
  }
  if (input.avatar_url !== undefined) {
    let validAvatarUrl = input.avatar_url === null;
    if (typeof input.avatar_url === 'string' && input.avatar_url.length <= 2048) {
      try { validAvatarUrl = ['http:', 'https:'].includes(new URL(input.avatar_url).protocol); } catch { validAvatarUrl = false; }
    }
    if (!validAvatarUrl) {
      throw new TypeError('avatar_url must be an HTTP(S) URL or null. Veiled does not accept Discord avatar bytes.');
    }
    body.avatarUrl = input.avatar_url;
  }
  if (input.channel_id !== undefined) {
    if (typeof input.channel_id !== 'string' || !input.channel_id) throw new TypeError('channel_id must be a Veiled lane ID.');
    body.laneId = input.channel_id;
  }
  if (!partial && body.name === undefined) throw new TypeError('Creating a webhook requires name.');
  if (partial && !Object.keys(body).length) throw new TypeError('Webhook update needs name, avatar_url, or channel_id.');
  return body;
}

function modalDefinition(input) {
  assertKeys(input, ['custom_id', 'title', 'components'], 'Discord modal');
  const text = (value, name, max) => {
    if (typeof value !== 'string' || !value.length || value.length > max) throw new TypeError('Modal ' + name + ' must be 1–' + max + ' characters.');
  };
  text(input.custom_id, 'custom_id', 100);
  text(input.title, 'title', 45);
  if (!Array.isArray(input.components) || input.components.length < 1 || input.components.length > 5) throw new TypeError('Modal components must contain 1–5 action rows.');
  const ids = new Set();
  const components = input.components.map((row, index) => {
    assertKeys(row, ['type', 'components'], 'Discord modal action row');
    if (row.type !== 1 || !Array.isArray(row.components) || row.components.length !== 1) throw new UnsupportedDiscordOperationError('Veiled modals support one text input in each type-1 action row.');
    const field = row.components[0];
    assertKeys(field, ['type', 'custom_id', 'style', 'label', 'min_length', 'max_length', 'required', 'value', 'placeholder'], 'Discord modal text input');
    if (field.type !== 4 || ![1, 2].includes(field.style)) throw new UnsupportedDiscordOperationError('Veiled modals support only Discord text inputs with style 1 or 2.');
    text(field.custom_id, 'input custom_id', 100);
    text(field.label, 'input label', 45);
    if (ids.has(field.custom_id)) throw new TypeError('Modal input custom_id values must be unique.');
    ids.add(field.custom_id);
    for (const [key, max] of [['placeholder', 100], ['value', 4000]]) {
      if (field[key] !== undefined && (typeof field[key] !== 'string' || field[key].length > max)) throw new TypeError('Modal ' + key + ' must be a string of at most ' + max + ' characters.');
    }
    for (const key of ['min_length', 'max_length']) {
      if (field[key] !== undefined && (!Number.isSafeInteger(field[key]) || field[key] < (key === 'min_length' ? 0 : 1) || field[key] > 4000)) throw new TypeError('Modal ' + key + ' is outside the supported 0–4000 character range.');
    }
    if (field.min_length !== undefined && field.max_length !== undefined && field.min_length > field.max_length) throw new TypeError('Modal min_length cannot exceed max_length.');
    if (field.required !== undefined && typeof field.required !== 'boolean') throw new TypeError('Modal required must be a boolean.');
    return { type: 1, components: [{ ...field }] };
  });
  return { custom_id: input.custom_id, title: input.title, components };
}

// These events have a verifiable semantic/payload analogue. They are plain
// projections, not discord.js Message/Interaction instances. Keep the rest
// unsupported until Veiled emits enough fields to make that mapping honest.
const EVENT_NAMES = Object.freeze({
  MESSAGE_CREATE: 'messageCreate',
  MESSAGE_UPDATE: 'messageUpdate',
  MESSAGE_DELETE: 'messageDelete',
  MESSAGE_REACTION_ADD: 'messageReactionAdd',
  MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
  MEMBER_JOIN: 'guildMemberAdd',
  MEMBER_LEAVE: 'guildMemberRemove',
  MEMBER_BAN: 'guildBanAdd',
  MEMBER_UNBAN: 'guildBanRemove',
  MEMBER_TIMEOUT: 'guildMemberUpdate',
  MEMBER_ROLE_ADD: 'guildMemberUpdate',
  MEMBER_ROLE_REMOVE: 'guildMemberUpdate',
  ROLE_CREATE: 'roleCreate',
  ROLE_UPDATE: 'roleUpdate',
  ROLE_DELETE: 'roleDelete',
  THREAD_CREATE: 'threadCreate',
  THREAD_UPDATE: 'threadUpdate',
  THREAD_DELETE: 'threadDelete',
  INVITE_CREATE: 'inviteCreate',
  INVITE_UPDATE: 'inviteUpdate',
  INVITE_DELETE: 'inviteDelete',
  WEBHOOK_CREATE: 'webhookUpdate',
  WEBHOOK_UPDATE: 'webhookUpdate',
  WEBHOOK_DELETE: 'webhookUpdate',
  VOICE_ROSTER_UPDATE: 'voiceStateUpdate',
  SCHEDULED_EVENT_UPDATE: 'guildScheduledEventUpdate',
  INTERACTION_CREATE: 'interactionCreate',
});
const EVENT_BY_DISCORD_NAME = new Map();
for (const [veiled, discord] of Object.entries(EVENT_NAMES)) {
  const events = EVENT_BY_DISCORD_NAME.get(discord) || [];
  events.push(veiled);
  EVENT_BY_DISCORD_NAME.set(discord, events);
}

function projectEvent(eventName, payload) {
  const discordName = EVENT_NAMES[eventName];
  if (!discordName) return null;
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : { data: payload };
  const result = { ...source, veiledEvent: eventName, discordName, projectionOnly: true };
  if (eventName.startsWith('MESSAGE_')) {
    if (eventName.startsWith('MESSAGE_REACTION_')) {
      if (typeof source.messageId !== 'string' || !source.messageId || typeof source.userId !== 'string' || !source.userId || typeof source.emoji !== 'string' || !source.emoji) {
        throw new TypeError(eventName + ' payload must include messageId, userId, and emoji.');
      }
      result.messageId = source.messageId;
      result.user_id = source.userId;
      return result;
    }
    const nestedMessage = source.message && typeof source.message === 'object' && !Array.isArray(source.message) ? source.message : null;
    const id = nestedMessage?.id ?? source.id ?? source.messageId;
    const channelId = source.laneId ?? source.channel_id ?? nestedMessage?.laneId;
    const roomId = source.roomId ?? source.lane?.roomId ?? nestedMessage?.lane?.roomId;
    if (typeof id !== 'string' || !id || typeof channelId !== 'string' || !channelId) {
      throw new TypeError(eventName + ' payload must include a message ID and lane/channel ID.');
    }
    result.id = id;
    result.messageId = id;
    result.channel_id = channelId;
    if (typeof roomId === 'string') result.guild_id = roomId;
    if (nestedMessage) result.message = nestedMessage;
  } else if (eventName.startsWith('MEMBER_')) {
    if (typeof source.roomId !== 'string' || !source.roomId || typeof source.userId !== 'string' || !source.userId) {
      throw new TypeError(eventName + ' payload must include roomId and userId.');
    }
    result.guild_id = source.roomId;
    result.user_id = source.userId;
    if (source.member && typeof source.member === 'object' && !Array.isArray(source.member)) result.member = source.member;
    if (eventName === 'MEMBER_ROLE_ADD' || eventName === 'MEMBER_ROLE_REMOVE') {
      if (typeof source.roleId !== 'string' || !source.roleId) throw new TypeError(eventName + ' payload must include roleId.');
      result.role_id = source.roleId;
    }
  } else if (eventName.startsWith('ROLE_')) {
    if (typeof source.roomId !== 'string' || !source.roomId) throw new TypeError(eventName + ' payload must include roomId.');
    result.guild_id = source.roomId;
    const role = source.role && typeof source.role === 'object' && !Array.isArray(source.role) ? source.role : null;
    const roleId = role?.id ?? source.roleId;
    if (typeof roleId !== 'string' || !roleId) throw new TypeError(eventName + ' payload must include role.id or roleId.');
    result.id = roleId;
    result.role_id = roleId;
    if (role) result.role = role;
  } else if (eventName.startsWith('THREAD_')) {
    if (typeof source.roomId !== 'string' || !source.roomId || typeof source.laneId !== 'string' || !source.laneId || typeof source.threadId !== 'string' || !source.threadId) {
      throw new TypeError(eventName + ' payload must include roomId, laneId, and threadId.');
    }
    result.guild_id = source.roomId;
    result.channel_id = source.laneId;
    result.id = source.threadId;
  } else if (eventName.startsWith('INVITE_')) {
    if (typeof source.roomId !== 'string' || !source.roomId || typeof source.inviteId !== 'string' || !source.inviteId) {
      throw new TypeError(eventName + ' payload must include roomId and inviteId.');
    }
    result.guild_id = source.roomId;
    result.id = source.inviteId;
    result.invite_id = source.inviteId;
  } else if (eventName.startsWith('WEBHOOK_')) {
    if (typeof source.roomId !== 'string' || !source.roomId || typeof source.laneId !== 'string' || !source.laneId || typeof source.webhookId !== 'string' || !source.webhookId) {
      throw new TypeError(eventName + ' payload must include roomId, laneId, and webhookId.');
    }
    result.guild_id = source.roomId;
    result.channel_id = source.laneId;
    result.id = source.webhookId;
    result.webhook_id = source.webhookId;
  } else if (eventName === 'VOICE_ROSTER_UPDATE') {
    if (typeof source.roomId !== 'string' || !source.roomId || typeof source.laneId !== 'string' || !source.laneId || typeof source.userId !== 'string' || !source.userId || !['join', 'leave'].includes(source.action)) {
      throw new TypeError('VOICE_ROSTER_UPDATE payload must include roomId, laneId, userId, and join/leave action.');
    }
    result.guild_id = source.roomId;
    result.channel_id = source.action === 'leave' ? null : source.laneId;
    result.user_id = source.userId;
  } else if (eventName === 'SCHEDULED_EVENT_UPDATE') {
    if (typeof source.roomId !== 'string' || !source.roomId || typeof source.eventId !== 'string' || !source.eventId || typeof source.action !== 'string' || !source.action) {
      throw new TypeError('SCHEDULED_EVENT_UPDATE payload must include roomId, eventId, and action.');
    }
    result.guild_id = source.roomId;
    result.id = source.eventId;
  } else {
    const interactionId = source.interaction_id ?? source.id;
    if (typeof interactionId !== 'string' || !interactionId || typeof source.application_id !== 'string' ||
        typeof source.channel_id !== 'string' || !source.channel_id || !source.data || typeof source.data !== 'object' ||
        !source.user || typeof source.user !== 'object') {
      throw new TypeError('INTERACTION_CREATE payload is missing required interaction, application, channel, data, or user fields.');
    }
    result.id = interactionId;
    result.interaction_id = interactionId;
  }
  return result;
}

function interactionPayload(input, { allowModal = false } = {}) {
  assertKeys(input, ['type', 'content', 'components', 'embeds', 'flags', 'ephemeral', 'stagedUploadIds', 'modal'], 'Discord interaction response');
  if (input.type === 'defer') {
    assertKeys(input, ['type'], 'Discord deferred interaction response');
    return { type: 'defer' };
  }
  if (input.type === 'modal') {
    if (!allowModal) throw new UnsupportedDiscordOperationError('Modal responses are supported only for application-command interactions, not component callbacks.');
    assertKeys(input, ['type', 'modal'], 'Discord modal response');
    return { type: 'modal', modal: modalDefinition(input.modal) };
  }
  if (!['reply', 'update'].includes(input.type)) {
    throw new UnsupportedDiscordOperationError('This adapter supports defer and one final reply/update; follow-ups and autocomplete are not translated.');
  }
  if (input.modal !== undefined) throw new UnsupportedDiscordOperationError('A modal payload is valid only with type: modal on an application-command interaction.');
  const flags = input.flags ?? 0;
  if (!Number.isSafeInteger(flags) || flags < 0 || (flags & ~(CV2_FLAG | EPHEMERAL_FLAG)) !== 0) {
    throw new UnsupportedDiscordOperationError('Only Components V2 and ephemeral interaction flags can be translated.');
  }
  if (input.ephemeral !== undefined && typeof input.ephemeral !== 'boolean') throw new TypeError('ephemeral must be a boolean.');
  const components = input.components === undefined ? undefined : serialize(input.components);
  const componentsV2 = hasCv2(components);
  if ((flags & CV2_FLAG) && !componentsV2) throw new UnsupportedDiscordOperationError('Components V2 flag requires a Veiled CV2 component layout.');
  if (componentsV2 && (input.content !== undefined || input.embeds !== undefined)) {
    throw new UnsupportedDiscordOperationError('Components V2 responses cannot include legacy content or embeds.');
  }
  if (input.stagedUploadIds !== undefined) {
    if (!Array.isArray(input.stagedUploadIds) || input.stagedUploadIds.length > 10 || input.stagedUploadIds.some((id) => typeof id !== 'string' || !ID_PATTERN.test(id))) {
      throw new TypeError('stagedUploadIds must contain at most 10 valid Veiled staged upload IDs (10–40 letters or digits). Stage files with the Veiled upload API first.');
    }
  }
  const result = { type: input.type };
  for (const key of ['content', 'embeds']) if (input[key] !== undefined) result[key] = serialize(input[key]);
  if (components !== undefined) result.components = components;
  if (input.stagedUploadIds !== undefined) result.stagedUploadIds = [...input.stagedUploadIds];
  if ((flags & EPHEMERAL_FLAG) || input.ephemeral === true) result.ephemeral = true;
  if (input.ephemeral === false && (flags & EPHEMERAL_FLAG)) throw new TypeError('Remove the EPHEMERAL flag when ephemeral is false.');
  return result;
}

export class DiscordBotAdapter {
  constructor(botOrClient) {
    this.bot = botOrClient?.api ? botOrClient : null;
    this.client = botOrClient?.api || botOrClient;
  }

  createMessage(channelId, payload) {
    return requireMethod(this.client, 'sendMessage')(channelId, toMessage(payload, { laneId: channelId, allowReply: true }));
  }

  async createThreadMessage(threadId, payload = {}) {
    if (typeof threadId !== 'string' || !threadId) throw new TypeError('A Discord thread channel ID is required.');
    const lookup = await requireMethod(this.client, 'getThread')(threadId);
    const thread = lookup?.thread;
    if (!thread || thread.id !== threadId || typeof thread.laneId !== 'string' || !thread.laneId || thread.laneId === threadId) {
      throw new UnsupportedDiscordOperationError('Veiled thread lookup did not return the requested thread ID and its parent laneId.');
    }
    const message = toMessage(payload, { laneId: thread.laneId, threadId, allowReply: true });
    message.threadId = threadId;
    return requireMethod(this.client, 'sendMessage')(thread.laneId, message);
  }

  editMessage(messageId, payload) {
    return requireMethod(this.client, 'editMessage')(messageId, toMessage(payload));
  }

  deleteMessage(messageId) { return requireMethod(this.client, 'deleteMessage')(messageId); }

  kickMember(roomId, userId, options = {}) {
    assertKeys(options, ['reason'], 'Discord kick');
    return requireMethod(this.client, 'kickMember')(roomId, userId, options.reason);
  }

  banMember(roomId, userId, options = {}) {
    assertKeys(options, ['reason'], 'Discord ban');
    return requireMethod(this.client, 'banMember')(roomId, userId, options);
  }

  unbanMember(roomId, userId) { return requireMethod(this.client, 'unbanMember')(roomId, userId); }

  timeoutMember(roomId, userId, duration, options = {}) {
    assertKeys(options, ['reason'], 'Discord timeout');
    if (!Number.isSafeInteger(duration) || duration < 60_000 || duration > 2_419_200_000 || duration % 1000 !== 0) {
      throw new TypeError('Discord timeout duration must be whole milliseconds from 60,000 (60 seconds) to 2,419,200,000 (28 days).');
    }
    return requireMethod(this.client, 'timeoutMember')(roomId, userId, duration / 1000, options.reason);
  }

  removeTimeout(roomId, userId) { return requireMethod(this.client, 'removeMemberTimeout')(roomId, userId); }

  createRole(roomId, role) { return requireMethod(this.client, 'createRole')(roomId, rolePayload(role)); }

  updateRole(roleId, role) { return requireMethod(this.client, 'updateRole')(roleId, rolePayload(role, true)); }

  assignRole(roomId, userId, roleId) { return requireMethod(this.client, 'assignRole')(roomId, userId, roleId); }

  removeRole(roomId, userId, roleId) { return requireMethod(this.client, 'removeRole')(roomId, userId, roleId); }

  reorderRoles(roomId, positions) {
    if (!Array.isArray(positions) || !positions.length) throw new TypeError('Role positions must be a non-empty array.');
    const normalized = positions.map((item) => {
      assertKeys(item, ['role_id', 'position'], 'Discord role position');
      if (!item.role_id || !Number.isSafeInteger(item.position) || item.position < 0) throw new TypeError('Each role position needs role_id and a non-negative integer position.');
      return { roleId: item.role_id, position: item.position };
    });
    return requireMethod(this.client, 'reorderRoles')(roomId, normalized);
  }

  deleteRole(roleId) { return requireMethod(this.client, 'deleteRole')(roleId); }

  createThread(channelId, input) {
    assertKeys(input, ['name', 'type', 'message'], 'Discord thread');
    if (!input.name || typeof input.name !== 'string' || input.name.length > 100) throw new TypeError('Thread name must be 1–100 characters.');
    if (input.type !== undefined && input.type !== 11) {
      throw new UnsupportedDiscordOperationError('Only Discord public threads have a supported Veiled forum-thread mapping; private/news threads are not translated.');
    }
    if (input.message !== undefined && typeof input.message !== 'string') {
      throw new UnsupportedDiscordOperationError('Only a text starter message can be mapped when creating a Veiled forum thread.');
    }
    return requireMethod(this.client, 'createThread')(channelId, {
      title: input.name,
      ...(input.message ? { content: input.message } : {}),
    });
  }

  archiveThread(threadId) { return requireMethod(this.client, 'archiveThread')(threadId); }
  unarchiveThread(threadId) { return requireMethod(this.client, 'unarchiveThread')(threadId); }
  lockThread(threadId) { return requireMethod(this.client, 'lockThread')(threadId); }
  unlockThread(threadId) { return requireMethod(this.client, 'unlockThread')(threadId); }
  deleteThread(threadId) { return requireMethod(this.client, 'deleteThread')(threadId); }

  createScheduledEvent(roomId, event) {
    return requireMethod(this.client, 'createScheduledEvent')(roomId, scheduledEventPayload(event));
  }

  updateScheduledEvent(eventId, event, scope = 'OCCURRENCE') {
    if (!['OCCURRENCE', 'SERIES'].includes(scope)) throw new TypeError('Scheduled-event scope must be OCCURRENCE or SERIES.');
    return requireMethod(this.client, 'updateScheduledEvent')(eventId, scheduledEventPayload(event, true), scope);
  }

  deleteScheduledEvent(eventId, scope = 'OCCURRENCE') {
    if (!['OCCURRENCE', 'SERIES'].includes(scope)) throw new TypeError('Scheduled-event scope must be OCCURRENCE or SERIES.');
    return requireMethod(this.client, 'cancelScheduledEvent')(eventId, scope);
  }

  respondToInteraction(interactionId, response) {
    return requireMethod(this.client, 'respondToInteraction')(interactionId, interactionPayload(response));
  }

  respondToCommandInteraction(interactionId, response) {
    return requireMethod(this.client, 'respondToCommandInteraction')(interactionId, interactionPayload(response, { allowModal: true }));
  }

  addReaction(messageId, emoji) {
    if (typeof emoji !== 'string' || !emoji) throw new TypeError('Reaction emoji must be a non-empty Veiled emoji value.');
    return requireMethod(this.client, 'addReaction')(messageId, emoji);
  }

  removeReaction(messageId, emoji) {
    if (typeof emoji !== 'string' || !emoji) throw new TypeError('Reaction emoji must be a non-empty Veiled emoji value.');
    return requireMethod(this.client, 'removeReaction')(messageId, emoji);
  }

  listReactionUsers(messageId, emoji, options = {}) {
    assertKeys(options, ['limit', 'after'], 'Discord reaction-user list options');
    if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100)) throw new TypeError('Reaction-user limit must be an integer from 1 to 100.');
    if (options.after !== undefined && (typeof options.after !== 'string' || !options.after)) throw new TypeError('Reaction-user after must be a Veiled reaction ID.');
    // Returns Veiled's { reactions, count } page, not a discord.js Collection.
    return requireMethod(this.client, 'getReactions')(messageId, emoji, options);
  }

  async removeUserReaction(messageId, emoji, userId) {
    if (typeof userId !== 'string' || !userId) throw new TypeError('A user ID is required to remove a reaction.');
    const identity = await requireMethod(this.client, 'getMe')();
    const botUserId = identity?.user?.id;
    if (!botUserId || userId !== botUserId) {
      throw new UnsupportedDiscordOperationError('The Veiled bot API can remove only the authenticated bot’s own reaction; it cannot remove another user’s reaction.');
    }
    return this.removeReaction(messageId, emoji);
  }

  listPins(channelId) { return requireMethod(this.client, 'getPins')(channelId); }
  pinMessage(messageId) { return requireMethod(this.client, 'pinMessage')(messageId); }
  unpinMessage(messageId) { return requireMethod(this.client, 'unpinMessage')(messageId); }
  sendTyping(channelId) { return requireMethod(this.client, 'sendTyping')(channelId); }

  createInvite(roomId, input = {}) {
    return requireMethod(this.client, 'createInvite')(roomId, invitePayload(input));
  }

  listInvites(roomId) { return requireMethod(this.client, 'getRoomInvites')(roomId); }
  getInvite(code) { return requireMethod(this.client, 'getInvite')(code); }
  updateInvite(code, input) { return requireMethod(this.client, 'updateInvite')(code, invitePayload(input, true)); }
  revokeInvite(code) { return requireMethod(this.client, 'revokeInvite')(code); }

  listWebhooks(channelId) { return requireMethod(this.client, 'getLaneWebhooks')(channelId); }
  getWebhook(webhookId) { return requireMethod(this.client, 'getWebhook')(webhookId); }

  createWebhook(channelId, input) {
    // The Veiled API returns a one-time execution URL. Callers must store it securely; this adapter never logs it.
    return requireMethod(this.client, 'createWebhook')(channelId, webhookPayload(input));
  }

  updateWebhook(webhookId, input) {
    return requireMethod(this.client, 'updateWebhook')(webhookId, webhookPayload(input, { partial: true }));
  }

  deleteWebhook(webhookId) { return requireMethod(this.client, 'deleteWebhook')(webhookId); }
  rotateWebhookToken(webhookId) {
    // The response contains a newly rotated secret URL. Do not log or print it.
    return requireMethod(this.client, 'resetWebhookToken')(webhookId);
  }

  executeWebhook() {
    throw new UnsupportedDiscordOperationError('Webhook execution is not exposed by this migration adapter. Veiled webhook URLs use a separate token and payload contract.');
  }

  on(discordEventName, listener) {
    if (typeof listener !== 'function') throw new TypeError('Event listener must be a function.');
    const veiledNames = EVENT_BY_DISCORD_NAME.get(discordEventName);
    if (!veiledNames) {
      throw new UnsupportedDiscordOperationError('Discord event ' + discordEventName + ' has no verified Veiled gateway mapping.');
    }
    const source = this.bot || this.client;
    const onGateway = requireMethod(source, 'onGateway');
    const unsubscribe = veiledNames.map((veiledName) => onGateway(veiledName, (payload) => listener(projectEvent(veiledName, payload))));
    return () => unsubscribe.map((off) => typeof off === 'function' ? off() : undefined).every((result) => result !== false);
  }
}
