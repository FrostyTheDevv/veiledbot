import { createContainer, escapeMarkdown } from './containers.js';

export const valueArray = (data, key) => Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];
export const messageId = (result) => result?.id || result?.message?.id || result?.data?.id || null;
export const displayUser = (user = {}) => user.displayName || user.username || user.name || 'Unknown user';
export const safeText = (value, max = 500) => escapeMarkdown(String(value ?? '').slice(0, max).replaceAll('@', '@​'));

export function resolveMediaUrl(value, baseOrigin = 'https://cdn.veiled.lol') {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) {
    try { return new URL(trimmed, baseOrigin).toString(); } catch { return null; }
  }
  return null;
}

export const DEFAULT_BOT_OWNER_IDS = Object.freeze(['cxvhyvwg3bn2pge6fk6axn3dy2']);

export function isBotOwner(bot, userId) {
  if (!userId) return false;
  const id = String(userId).trim();
  if (!id) return false;
  if (DEFAULT_BOT_OWNER_IDS.includes(id)) return true;
  const configured = bot?.config?.ownerIds;
  if (Array.isArray(configured) && configured.includes(id)) return true;
  if (typeof bot?.config?.ownerId === 'string' && bot.config.ownerId.trim() === id) return true;
  const ownerCandidates = [
    bot?.ownerId,
    bot?.application?.ownerId,
    bot?.application?.owner?.id,
    bot?.application?.userId,
    bot?.application?.creatorId,
    bot?.user?.ownerId,
  ].filter(Boolean).map(String);
  return ownerCandidates.includes(id);
}

export async function resolveRoomMember(client, roomId, rawQuery) {
  const cleaned = parseMentionId(rawQuery || '');
  if (!cleaned) return null;
  const query = cleaned.toLowerCase();
  if (typeof client?.getMembers === 'function' && roomId) {
    try {
      const response = await client.getMembers(roomId);
      const members = valueArray(response, 'members');
      const member = members.find((item) => {
        const user = item.User || item.user || {};
        return (
          item.userId?.toLowerCase() === query ||
          user.id?.toLowerCase() === query ||
          user.username?.toLowerCase() === query ||
          user.displayName?.toLowerCase() === query ||
          item.nickname?.toLowerCase() === query
        );
      });
      if (member) {
        const user = member.User || member.user || {};
        return {
          userId: member.userId || user.id,
          member,
          user,
          label: member.nickname || user.displayName || user.username || member.userId || user.id,
        };
      }
    } catch {
      // Fall back to direct ID check if member list lookup is unavailable
    }
  }
  if (/^[a-zA-Z0-9_-]{3,100}$/.test(cleaned)) {
    return { userId: cleaned, member: null, user: { id: cleaned }, label: cleaned };
  }
  return null;
}

export async function replyCard(client, message, card) {
  return client.sendMessage(message.laneId, {
    components: createContainer(card),
    ...(message?.id ? { replyToId: message.id } : {}),
  });
}

export function errorCard(error, title = 'Command failed') {
  const text = error?.status === 403
    ? (error?.message ? `The bot is missing permission for that action (${safeText(error.message, 220)}).` : 'The bot is missing permission for that action.')
    : error?.status === 404 ? 'I could not find that Veiled resource.'
      : error?.status === 429 ? `I am being rate limited. Try again in ${Math.max(1, Math.ceil(error.retryAfter || 2))} seconds.`
        : error?.status === 0 ? 'I could not reach Veiled right now. Try again shortly.'
          : error?.status >= 400 && error?.status < 500 && error?.message ? safeText(error.message, 300)
          : 'Something went wrong while running that command.';
  return { title, description: text, accentColor: 0xed4245 };
}

export function parseMentionId(value = '') {
  return String(value).replace(/[<@!>]/g, '').trim();
}

export function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : 'Unknown';
}
