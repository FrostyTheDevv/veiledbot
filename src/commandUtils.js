import { createContainer, escapeMarkdown } from './containers.js';

export const valueArray = (data, key) => Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];
export const messageId = (result) => result?.id || result?.message?.id || result?.data?.id || null;
export const displayUser = (user = {}) => user.displayName || user.username || user.name || 'Unknown user';
export const safeText = (value, max = 500) => escapeMarkdown(String(value ?? '').slice(0, max).replaceAll('@', '@​'));

export async function replyCard(client, message, card) {
  return client.sendMessage(message.laneId, {
    components: createContainer(card),
    ...(message?.id ? { replyToId: message.id } : {}),
  });
}

export function errorCard(error, title = 'Command failed') {
  const text = error?.status === 403 ? 'The bot is missing permission for that action.'
    : error?.status === 404 ? 'I could not find that Veiled resource.'
      : error?.status === 429 ? `I am being rate limited. Try again in ${Math.max(1, Math.ceil(error.retryAfter || 2))} seconds.`
        : error?.status === 0 ? 'I could not reach Veiled right now. Try again shortly.'
          : error?.status >= 400 && error?.status < 500 && error?.message ? safeText(error.message, 300)
          : 'Something went wrong while running that command.';
  return { title, description: text, accentColor: 0xed4245 };
}

export function parseMentionId(value = '') {
  return value.replace(/[<@!>]/g, '').trim();
}

export function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : 'Unknown';
}
