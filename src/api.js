import { config } from './config.js';
import { createContainer, isValidContainerPayload } from './containers.js';

export class VeiledApiError extends Error {
  constructor(status, message, details = null, retryAfter = null) {
    super(message);
    this.name = 'VeiledApiError';
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

export class VeiledClient {
  constructor(token = config.token, baseUrl = config.apiUrl, fetchImpl = globalThis.fetch) {
    this.token = String(token || '').replace(/^Bot\s+/i, '').trim();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetch = fetchImpl;
  }

  async request(path, options = {}) {
    const url = new URL(path.replace(/^\/+/, ''), `${this.baseUrl}/`);
    const base = new URL(this.baseUrl);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname.replace(/\/?$/, '/'))) throw new TypeError('API paths must remain inside the configured API base URL.');
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    if (this.token) headers.set('Authorization', `Bot ${this.token}`);
    let body = options.body;
    if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string' && !(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body)) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    let response;
    try {
      response = await this.fetch(url, { ...options, method, headers, body, signal: options.signal || AbortSignal.timeout(15000) });
    } catch (error) {
      throw new VeiledApiError(0, error?.name === 'TimeoutError' ? 'The Veiled API request timed out.' : 'Could not reach the Veiled API.');
    }
    if (!response.ok) {
      const data = await response.json().catch(async () => ({ error: (await response.text().catch(() => '')).slice(0, 500) }));
      const retryAfter = Number(response.headers.get('retry-after')) || null;
      throw new VeiledApiError(response.status, data?.error || `Veiled API returned HTTP ${response.status}.`, data, retryAfter);
    }
    if (response.status === 204) return null;
    const type = response.headers.get('content-type') || '';
    return type.includes('application/json') ? response.json() : response.text();
  }

  getMe() { return this.request('/bots/@me'); }
  getMyRooms() { return this.request('/bots/@me/rooms'); }
  getGateway() { return this.request('/bots/gateway'); }
  leaveRoom(roomId) { return this.request(`/bots/@me/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' }); }
  getRoom(roomId) { return this.request(`/rooms/${encodeURIComponent(roomId)}`); }
  getLanes(roomId) { return this.request(`/rooms/${encodeURIComponent(roomId)}/lanes`); }
  getLane(laneId) { return this.request(`/lanes/${encodeURIComponent(laneId)}`); }
  getMembers(roomId, query = '') { return this.request(`/rooms/${encodeURIComponent(roomId)}/members${query ? `?${query}` : ''}`); }
  getRoomRoles(roomId) { return this.request(`/rooms/${encodeURIComponent(roomId)}/roles`); }
  getMemberRoles(roomId, userId) { return this.request(`/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}/roles`); }
  createRole(roomId, payload) { return this.request(`/rooms/${encodeURIComponent(roomId)}/roles`, { method: 'POST', body: payload }); }
  assignRole(roomId, userId, roleId) { return this.request(`/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, { method: 'PUT', body: {} }); }
  removeRole(roomId, userId, roleId) { return this.request(`/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' }); }
  reorderRoles(roomId, positions) { return this.request(`/rooms/${encodeURIComponent(roomId)}/roles/reorder`, { method: 'PUT', body: { positions } }); }
  updateRole(roleId, payload) { return this.request(`/roles/${encodeURIComponent(roleId)}`, { method: 'PATCH', body: payload }); }
  deleteRole(roleId) { return this.request(`/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' }); }
  kickMember(roomId, userId, reason) { return this.request(`/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE', body: reason ? { reason } : {} }); }
  banMember(roomId, userId, options = {}) { return this.request(`/rooms/${encodeURIComponent(roomId)}/bans/${encodeURIComponent(userId)}`, { method: 'PUT', body: options }); }
  unbanMember(roomId, userId) { return this.request(`/rooms/${encodeURIComponent(roomId)}/bans/${encodeURIComponent(userId)}`, { method: 'DELETE' }); }
  timeoutMember(roomId, userId, duration, reason) { return this.request(`/rooms/${encodeURIComponent(roomId)}/timeouts`, { method: 'POST', body: { userId, duration, ...(reason ? { reason } : {}) } }); }
  removeMemberTimeout(roomId, userId) { return this.request(`/rooms/${encodeURIComponent(roomId)}/timeouts/${encodeURIComponent(userId)}`, { method: 'DELETE' }); }
  getMessages(laneId, query = '') { return this.request(`/lanes/${encodeURIComponent(laneId)}/messages${query ? `?${query}` : ''}`); }
  getLaneCapabilities(laneId) { return this.request(`/lanes/${encodeURIComponent(laneId)}/capabilities`); }
  getLaneThreads(laneId, query = '') { return this.request(`/lanes/${encodeURIComponent(laneId)}/threads${query ? `?${query}` : ''}`); }
  createThread(laneId, payload) { return this.request(`/lanes/${encodeURIComponent(laneId)}/threads`, { method: 'POST', body: payload }); }
  getThread(threadId) { return this.request(`/threads/${encodeURIComponent(threadId)}`); }
  updateThread(threadId, payload) { return this.request(`/threads/${encodeURIComponent(threadId)}`, { method: 'PATCH', body: payload }); }
  getThreadMessages(threadId, query = '') { return this.request(`/threads/${encodeURIComponent(threadId)}/messages${query ? `?${query}` : ''}`); }
  getThreadMembers(threadId) { return this.request(`/threads/${encodeURIComponent(threadId)}/members`); }
  addThreadMember(threadId, userId) { return this.request(`/threads/${encodeURIComponent(threadId)}/members`, { method: 'POST', body: { userId } }); }
  removeThreadMember(threadId, userId) { return this.request(`/threads/${encodeURIComponent(threadId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }); }
  sendThreadMessage(threadId, content) { return this.request(`/threads/${encodeURIComponent(threadId)}/messages`, { method: 'POST', body: { content } }); }
  archiveThread(threadId) { return this.request(`/threads/${encodeURIComponent(threadId)}/archive`, { method: 'POST', body: {} }); }
  unarchiveThread(threadId) { return this.request(`/threads/${encodeURIComponent(threadId)}/unarchive`, { method: 'POST', body: {} }); }
  lockThread(threadId) { return this.request(`/threads/${encodeURIComponent(threadId)}/lock`, { method: 'POST', body: {} }); }
  unlockThread(threadId) { return this.request(`/threads/${encodeURIComponent(threadId)}/unlock`, { method: 'POST', body: {} }); }
  pinThread(threadId) { return this.request(`/threads/${encodeURIComponent(threadId)}/pin`, { method: 'POST', body: {} }); }
  publishThread(threadId) { return this.request(`/threads/${encodeURIComponent(threadId)}/publish`, { method: 'POST', body: {} }); }
  deleteThread(threadId) { return this.request(`/threads/${encodeURIComponent(threadId)}`, { method: 'DELETE' }); }
  createInvite(roomId, options = {}, idempotencyKey) {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
    return this.request(`/rooms/${encodeURIComponent(roomId)}/invites`, { method: 'POST', body: options, headers });
  }
  getInvite(code) { return this.request(`/invites/${encodeURIComponent(code)}`); }
  getRoomInvites(roomId) { return this.request(`/rooms/${encodeURIComponent(roomId)}/invites`); }
  updateInvite(code, payload) { return this.request(`/invites/${encodeURIComponent(code)}`, { method: 'PATCH', body: payload }); }
  revokeInvite(code) { return this.request(`/invites/${encodeURIComponent(code)}`, { method: 'DELETE' }); }
  getScheduledEvents(roomId, query = '') { return this.request(`/rooms/${encodeURIComponent(roomId)}/events${query ? `?${query}` : ''}`); }
  getScheduledEvent(eventId) { return this.request(`/events/${encodeURIComponent(eventId)}`); }
  createScheduledEvent(roomId, payload) { return this.request(`/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', body: payload }); }
  updateScheduledEvent(eventId, payload, scope = 'OCCURRENCE') { return this.request(`/events/${encodeURIComponent(eventId)}?scope=${encodeURIComponent(scope)}`, { method: 'PATCH', body: payload }); }
  cancelScheduledEvent(eventId, scope = 'OCCURRENCE') { return this.request(`/events/${encodeURIComponent(eventId)}?scope=${encodeURIComponent(scope)}`, { method: 'DELETE' }); }
  setEventRsvp(eventId, status) { return this.request(`/events/${encodeURIComponent(eventId)}/rsvp`, { method: 'PUT', body: { status } }); }
  removeEventRsvp(eventId) { return this.request(`/events/${encodeURIComponent(eventId)}/rsvp`, { method: 'DELETE' }); }
  getPins(laneId) { return this.request(`/lanes/${encodeURIComponent(laneId)}/pins`); }
  getVoiceStates(laneId) { return this.request(`/lanes/${encodeURIComponent(laneId)}/voice-states`); }
  pinMessage(messageId) { return this.request(`/messages/${encodeURIComponent(messageId)}/pin`, { method: 'POST', body: {} }); }
  unpinMessage(messageId) { return this.request(`/messages/${encodeURIComponent(messageId)}/pin`, { method: 'DELETE' }); }
  joinVoice(laneId, sessionId) { return this.request('/voice/join', { method: 'POST', body: { laneId, ...(sessionId ? { sessionId } : {}) } }); }
  leaveVoice(laneId) { return this.request('/voice/leave', { method: 'POST', body: { laneId } }); }
  getReactions(messageId, emoji) { return this.request(`/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`); }

  async sendMessage(laneId, payload = {}) {
    const body = { ...payload };
    if (body.components !== undefined && !Array.isArray(body.components)) throw new TypeError('components must be an array.');
    return this.request(`/lanes/${encodeURIComponent(laneId)}/messages`, { method: 'POST', body });
  }

  createPoll(laneId, { question, options, durationHours = 24, allowMultiselect = false, replyToId } = {}) {
    const allowedDurations = new Set([0, 1, 6, 24, 72, 168]);
    if (typeof question !== 'string' || !question.trim() || question.trim().length > 150) throw new TypeError('Poll question must be 1–150 characters.');
    if (!Array.isArray(options) || options.length < 2 || options.length > 10 || options.some((option) => typeof option !== 'string' || !option.trim() || option.trim().length > 80)) throw new TypeError('A poll needs 2–10 options, each 1–80 characters.');
    if (!allowedDurations.has(durationHours) || typeof allowMultiselect !== 'boolean') throw new TypeError('Poll duration or multiselect value is invalid.');
    const content = `[POLL_DATA]${JSON.stringify({ question: question.trim(), options: options.map((option) => option.trim()), durationHours, allowMultiselect, createdAt: new Date().toISOString() })}`;
    return this.sendMessage(laneId, { content, ...(replyToId ? { replyToId } : {}) });
  }

  sendContainer(laneId, card, { replyToId, linkButtons } = {}) {
    const components = createContainer({ ...card, linkButtons: linkButtons || card?.linkButtons });
    if (!isValidContainerPayload(components)) throw new TypeError('Container must use a Components V2 container root.');
    return this.sendMessage(laneId, { components, ...(replyToId ? { replyToId } : {}) });
  }

  async stageUpload(file, { filename, contentType = 'application/octet-stream', description } = {}) {
    const blob = file instanceof Blob ? file : new Blob([file], { type: contentType });
    const form = new FormData();
    form.append('file', blob, filename || file?.name || 'upload.bin');
    if (description) form.append('description', description);
    return this.request('/uploads/staged', { method: 'POST', body: form });
  }

  async sendContainerWithFiles(laneId, card, files, options = {}) {
    const staged = [];
    for (const file of files) staged.push(await this.stageUpload(file.data ?? file, file));
    const components = createContainer(card);
    const message = await this.sendMessage(laneId, {
      components,
      stagedUploadIds: staged.map((item) => item.id),
      ...(options.replyToId ? { replyToId: options.replyToId } : {}),
    });
    return { message, uploads: staged };
  }

  sendTyping(laneId) { return this.request(`/lanes/${encodeURIComponent(laneId)}/typing`, { method: 'POST', body: {} }); }
  editMessage(messageId, payload) { return this.request(`/messages/${encodeURIComponent(messageId)}`, { method: 'PATCH', body: payload }); }
  deleteMessage(messageId) { return this.request(`/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' }); }
  addReaction(messageId, emoji) { return this.request(`/messages/${encodeURIComponent(messageId)}/reactions`, { method: 'POST', body: { emoji } }); }
  removeReaction(messageId, emoji) { return this.request(`/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE' }); }

  getLaneWebhooks(laneId) { return this.request(`/lanes/${encodeURIComponent(laneId)}/webhooks`); }
  getWebhook(webhookId) { return this.request(`/webhooks/${encodeURIComponent(webhookId)}`); }
  createWebhook(laneId, payload) { return this.request(`/lanes/${encodeURIComponent(laneId)}/webhooks`, { method: 'POST', body: payload }); }
  updateWebhook(webhookId, payload) { return this.request(`/webhooks/${encodeURIComponent(webhookId)}`, { method: 'PATCH', body: payload }); }
  resetWebhookToken(webhookId) { return this.request(`/webhooks/${encodeURIComponent(webhookId)}/token`, { method: 'POST', body: {} }); }
  deleteWebhook(webhookId) { return this.request(`/webhooks/${encodeURIComponent(webhookId)}`, { method: 'DELETE' }); }

  respondToInteraction(interactionId, payload) {
    return this.request(`/interactions/${encodeURIComponent(interactionId)}/callback`, { method: 'POST', body: payload });
  }

  respondToCommandInteraction(interactionId, payload) {
    return this.request(`/interactions/commands/${encodeURIComponent(interactionId)}/callback`, { method: 'POST', body: payload });
  }
}
