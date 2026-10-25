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
  getMessages(laneId, query = '') { return this.request(`/lanes/${encodeURIComponent(laneId)}/messages${query ? `?${query}` : ''}`); }
  getReactions(messageId, emoji) { return this.request(`/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`); }

  async sendMessage(laneId, payload = {}) {
    const body = { ...payload };
    if (body.components !== undefined && !Array.isArray(body.components)) throw new TypeError('components must be an array.');
    return this.request(`/lanes/${encodeURIComponent(laneId)}/messages`, { method: 'POST', body });
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

  respondToInteraction(interactionId, payload) {
    return this.request(`/interactions/${encodeURIComponent(interactionId)}/callback`, { method: 'POST', body: payload });
  }
}