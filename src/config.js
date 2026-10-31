import dotenv from 'dotenv';

// The compatibility sandbox keeps credentials in a separate ignored file so
// local Discord/Veiled testing never changes the normal developer .env.
const envFile = process.env.VEILEDBOT_ENV_FILE || '.env';
dotenv.config({ path: envFile });

export const BOT_GATEWAY_INTENTS = Object.freeze({
  ROOMS: 1 << 0,
  MEMBERS: 1 << 1,
  MESSAGES: 1 << 2,
  MESSAGE_CONTENT: 1 << 3,
  REACTIONS: 1 << 4,
  PRESENCE: 1 << 5,
  THREADS: 1 << 6,
  INVITES: 1 << 7,
  WEBHOOKS: 1 << 8,
  POLLS: 1 << 9,
  MODERATION: 1 << 10,
  VOICE_STATES: 1 << 11,
  SCHEDULED_EVENTS: 1 << 12,
  INTERACTIONS: 1 << 13,
  ROLES: 1 << 14,
});

// Match the API's DEFAULT_BOT_GATEWAY_INTENTS. Privileged intents are opt-in.
export const DEFAULT_BOT_GATEWAY_INTENTS = [
  'ROOMS', 'MESSAGES', 'REACTIONS', 'THREADS', 'INVITES', 'WEBHOOKS', 'POLLS',
  'MODERATION', 'VOICE_STATES', 'SCHEDULED_EVENTS', 'INTERACTIONS', 'ROLES',
].reduce((mask, name) => mask | BOT_GATEWAY_INTENTS[name], 0);

const knownIntentMask = Object.values(BOT_GATEWAY_INTENTS).reduce((mask, bit) => mask | bit, 0);

export function parseGatewayIntents(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_BOT_GATEWAY_INTENTS;
  const value = String(raw).trim();
  if (/^\d+$/.test(value)) {
    const numeric = Number(value);
    if (Number.isSafeInteger(numeric) && numeric >= 0 && (numeric & ~knownIntentMask) === 0) return numeric;
    throw new Error('VEILED_BOT_INTENTS contains invalid or unknown intent bits.');
  }
  let mask = 0;
  for (const rawName of value.split(',')) {
    const name = rawName.trim().toUpperCase();
    if (!name || !(name in BOT_GATEWAY_INTENTS)) throw new Error(`Unknown Veiled gateway intent: ${rawName.trim() || '(empty)'}.`);
    mask |= BOT_GATEWAY_INTENTS[name];
  }
  return mask;
}

function parseIntegerEnv(name, raw, fallback) {
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^\d+$/.test(raw.trim())) throw new Error(`${name} must be a non-negative integer.`);
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe integer.`);
  return value;
}

const token = (process.env.VEILED_BOT_TOKEN || process.env.TOKEN || '').replace(/^Bot\s+/i, '').trim();
const apiUrl = (process.env.VEILED_API_URL || process.env.API_URL || 'https://api.veiled.lol/api/v1').replace(/\/+$/, '');
const gatewayUrl = (process.env.VEILED_GATEWAY_URL || process.env.GATEWAY_URL || '').trim();
const commandPrefix = process.env.BOT_PREFIX || '!';
const gatewayIntents = parseGatewayIntents(process.env.VEILED_BOT_INTENTS);
const shardId = parseIntegerEnv('VEILED_BOT_SHARD_ID', process.env.VEILED_BOT_SHARD_ID, 0);
const shardCount = parseIntegerEnv('VEILED_BOT_SHARD_COUNT', process.env.VEILED_BOT_SHARD_COUNT, 1);

export const config = Object.freeze({
  token, apiUrl, gatewayUrl, commandPrefix,
  gatewayIntents,
  shard: Object.freeze([shardId, shardCount]),
});

export function validateConfig(target = config) {
  if (!target.token) throw new Error('VEILED_BOT_TOKEN is required. Copy .env.example to .env and add your bot token.');
  for (const [name, value] of [['VEILED_API_URL', target.apiUrl], ['VEILED_GATEWAY_URL', target.gatewayUrl]]) {
    if (!value) continue;
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error(`${name} must be a valid URL.`); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${name} must use HTTP or HTTPS.`);
    if (parsed.username || parsed.password) throw new Error(`${name} must not contain credentials.`);
  }
  if (target.commandPrefix.length > 8 || /\s/.test(target.commandPrefix)) throw new Error('BOT_PREFIX must be 1–8 non-space characters.');
  if (!Number.isSafeInteger(target.gatewayIntents) || target.gatewayIntents < 0 || (target.gatewayIntents & ~knownIntentMask) !== 0) {
    throw new Error('VEILED_BOT_INTENTS contains invalid or unknown intent bits.');
  }
  const [shardIdValue, shardCountValue] = target.shard;
  if (!Number.isInteger(shardIdValue) || !Number.isInteger(shardCountValue) || shardCountValue < 1 || shardCountValue > 1024 || shardIdValue < 0 || shardIdValue >= shardCountValue) {
    throw new Error('Shard must satisfy 0 <= VEILED_BOT_SHARD_ID < VEILED_BOT_SHARD_COUNT <= 1024.');
  }
  return true;
}
