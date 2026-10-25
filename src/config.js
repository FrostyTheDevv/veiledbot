import dotenv from 'dotenv';

dotenv.config();

const token = (process.env.VEILED_BOT_TOKEN || process.env.TOKEN || '').replace(/^Bot\s+/i, '').trim();
const apiUrl = (process.env.VEILED_API_URL || process.env.API_URL || 'https://api.veiled.lol/api/v1').replace(/\/+$/, '');
const gatewayUrl = (process.env.VEILED_GATEWAY_URL || process.env.GATEWAY_URL || '').trim();
const commandPrefix = process.env.BOT_PREFIX || '!';

export const config = Object.freeze({ token, apiUrl, gatewayUrl, commandPrefix });

export function validateConfig() {
  if (!config.token) throw new Error('VEILED_BOT_TOKEN is required. Copy .env.example to .env and add your bot token.');
  for (const [name, value] of [['VEILED_API_URL', config.apiUrl], ['VEILED_GATEWAY_URL', config.gatewayUrl]]) {
    if (!value) continue;
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error(`${name} must be a valid URL.`); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${name} must use HTTP or HTTPS.`);
    if (parsed.username || parsed.password) throw new Error(`${name} must not contain credentials.`);
  }
  if (config.commandPrefix.length > 8 || /\s/.test(config.commandPrefix)) throw new Error('BOT_PREFIX must be 1–8 non-space characters.');
  return true;
}