import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { escapeMarkdown } from './containers.js';

const dataDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'data');

class JsonFile {
  constructor(filename, fallback, directory = dataDir) { this.path = join(directory, filename); this.fallback = fallback; }
  read() {
    try { return JSON.parse(readFileSync(this.path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return structuredClone(this.fallback); throw new Error('Could not read persisted bot state at ' + this.path + ': ' + error.message); }
  }
  write(value) {
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(temp, this.path);
  }
}

export class AfkStore {
  constructor(directory = dataDir) { this.file = new JsonFile('afk.json', {}, directory); this.entries = {}; this.noticeTimes = new Map(); }
  load() { const data = this.file.read(); this.entries = data && typeof data === 'object' && !Array.isArray(data) ? data : {}; }
  get(userId) { return this.entries[String(userId)] || null; }
  set(userId, reason) {
    this.entries[String(userId)] = { reason: String(reason || '').slice(0, 300), since: new Date().toISOString() };
    this.file.write(this.entries);
    return this.entries[String(userId)];
  }
  clear(userId) { const id = String(userId); if (!this.entries[id]) return false; delete this.entries[id]; this.file.write(this.entries); return true; }
  shouldNotify(authorId, targetId) {
    const key = `${authorId}:${targetId}`, now = Date.now(), last = this.noticeTimes.get(key) || 0;
    if (now - last < 30_000) return false;
    this.noticeTimes.set(key, now);
    if (this.noticeTimes.size > 2000) this.noticeTimes.clear();
    return true;
  }
}

export class PrefixStore {
  constructor(directory = dataDir) { this.file = new JsonFile('prefixes.json', {}, directory); this.entries = {}; }
  load() { const data = this.file.read(); this.entries = data && typeof data === 'object' && !Array.isArray(data) ? data : {}; }
  get(userId) {
    const val = this.entries[String(userId)];
    return typeof val === 'string' && val.length ? val : null;
  }
  set(userId, prefix) {
    const clean = String(prefix || '').trim();
    if (!clean || clean.length > 8 || /\s/.test(clean)) {
      throw new RangeError('Prefix must be 1–8 non-space characters.');
    }
    this.entries[String(userId)] = clean;
    this.file.write(this.entries);
    return clean;
  }
  clear(userId) {
    const id = String(userId);
    if (!this.entries[id]) return false;
    delete this.entries[id];
    this.file.write(this.entries);
    return true;
  }
}

export class TimezoneStore {
  constructor(directory = dataDir) { this.file = new JsonFile('timezones.json', {}, directory); this.entries = {}; }
  load() { const data = this.file.read(); this.entries = data && typeof data === 'object' && !Array.isArray(data) ? data : {}; }
  get(userId) {
    const val = this.entries[String(userId)];
    return typeof val === 'string' && val.length ? val : null;
  }
  set(userId, timeZone) {
    const clean = String(timeZone || '').trim();
    if (!clean || clean.length > 100) throw new RangeError('Invalid time zone.');
    this.entries[String(userId)] = clean;
    this.file.write(this.entries);
    return clean;
  }
  clear(userId) {
    const id = String(userId);
    if (!this.entries[id]) return false;
    delete this.entries[id];
    this.file.write(this.entries);
    return true;
  }
}

export class AutoReactStore {
  constructor(directory = dataDir) { this.file = new JsonFile('autoreact.json', [], directory); this.entries = []; }
  load() {
    const data = this.file.read();
    this.entries = Array.isArray(data) ? data.filter((entry) => entry?.id && entry?.trigger && entry?.emoji) : [];
  }
  save() { this.file.write(this.entries); }
  list(roomId, laneId) {
    return this.entries.filter((entry) => (roomId && entry.roomId === String(roomId)) || (!entry.roomId && laneId && entry.laneId === String(laneId)));
  }
  add({ roomId, laneId, trigger, isPhrase = false, emoji, createdBy }) {
    const cleanTrigger = String(trigger || '').trim();
    const cleanEmoji = String(emoji || '').trim();
    if (!cleanTrigger || cleanTrigger.length > 120) throw new RangeError('Trigger must be 1–120 characters.');
    if (!cleanEmoji || cleanEmoji.length > 64) throw new RangeError('Emoji must be 1–64 characters.');
    const existingList = this.list(roomId, laneId);
    if (existingList.length >= 50) throw new RangeError('This room already has the maximum of 50 auto-reactions.');
    const duplicate = existingList.find((item) => item.trigger.toLowerCase() === cleanTrigger.toLowerCase() && item.emoji === cleanEmoji);
    if (duplicate) return duplicate;
    const entry = {
      id: randomUUID().slice(0, 8),
      roomId: roomId ? String(roomId) : null,
      laneId: laneId ? String(laneId) : null,
      trigger: cleanTrigger,
      isPhrase: Boolean(isPhrase),
      emoji: cleanEmoji,
      createdBy: createdBy ? String(createdBy) : null,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    this.save();
    return entry;
  }
  remove(roomId, laneId, query) {
    const target = String(query || '').trim().replace(/^"|"$/g, '').toLowerCase();
    if (!target) return null;
    const index = this.entries.findIndex((entry) => {
      const sameScope = (roomId && entry.roomId === String(roomId)) || (!entry.roomId && laneId && entry.laneId === String(laneId)) || (laneId && entry.laneId === String(laneId));
      return sameScope && (entry.id.toLowerCase() === target || entry.trigger.toLowerCase() === target);
    });
    if (index < 0) return null;
    const [removed] = this.entries.splice(index, 1);
    this.save();
    return removed;
  }
  clear(roomId, laneId) {
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => !((roomId && entry.roomId === String(roomId)) || (laneId && entry.laneId === String(laneId))));
    const removed = before - this.entries.length;
    if (removed > 0) this.save();
    return removed;
  }
  match(roomId, laneId, content) {
    const text = String(content || '').toLowerCase();
    if (!text) return [];
    const words = new Set(text.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean));
    const rules = this.entries.filter((entry) => (roomId && entry.roomId === String(roomId)) || (laneId && entry.laneId === String(laneId)));
    const matched = [];
    for (const rule of rules) {
      const needle = rule.trigger.toLowerCase();
      if (rule.isPhrase) {
        if (text.includes(needle)) matched.push(rule);
      } else if (words.has(needle)) {
        matched.push(rule);
      }
      if (matched.length >= 5) break;
    }
    return matched;
  }
}

export class AutomodStore {
  constructor(directory = dataDir) { this.file = new JsonFile('automod.json', {}, directory); this.entries = {}; this.windows = new Map(); }
  load() { const data = this.file.read(); this.entries = data && typeof data === 'object' && !Array.isArray(data) ? data : {}; }
  get(roomId) { return this.entries[String(roomId)] || { links: false, caps: false, massMentions: false, spam: false, allowedDomains: [] }; }
  set(roomId, key, value) {
    const id = String(roomId);
    const current = this.get(id);
    if (!['links', 'caps', 'massMentions', 'spam'].includes(key)) throw new RangeError('Unknown automod rule.');
    this.entries[id] = { ...current, [key]: Boolean(value), allowedDomains: current.allowedDomains || [] };
    this.file.write(this.entries);
    return this.entries[id];
  }
  isSpam(roomId, userId, now = Date.now()) {
    const key = `${roomId}:${userId}`;
    const recent = (this.windows.get(key) || []).filter((stamp) => now - stamp < 10_000);
    recent.push(now);
    this.windows.set(key, recent);
    if (this.windows.size > 5000) this.windows.clear();
    return recent.length > 6;
  }
}

export class HighlightStore {
  constructor(directory = dataDir) { this.file = new JsonFile('highlights.json', [], directory); this.entries = []; }

  load() {
    const data = this.file.read();
    this.entries = Array.isArray(data) ? data.filter((entry) => entry?.id && entry?.userId && entry?.trigger) : [];
  }

  save() { this.file.write(this.entries); }

  _matchesScope(entry, userId, roomId = null) {
    if (entry.userId !== String(userId)) return false;
    if (!roomId) return true;
    return !entry.roomId || entry.roomId === String(roomId);
  }

  list(userId, roomId = null) {
    return this.entries.filter((entry) => this._matchesScope(entry, userId, roomId));
  }

  add(userId, trigger, { roomId = null, isPhrase } = {}) {
    const clean = String(trigger || '').trim().replace(/^["']|["']$/g, '').trim();
    if (!clean || clean.length > 120) throw new RangeError('Highlight word or phrase must be 1–120 characters.');
    const uid = String(userId);
    const scopeList = this.list(uid, roomId);
    if (scopeList.length >= 50) throw new RangeError('You can have at most 50 highlights.');
    const duplicate = scopeList.find((item) => item.trigger.toLowerCase() === clean.toLowerCase());
    if (duplicate) return { entry: duplicate, duplicate: true };
    const entry = {
      id: randomUUID().slice(0, 8),
      userId: uid,
      roomId: roomId ? String(roomId) : null,
      trigger: clean,
      isPhrase: typeof isPhrase === 'boolean' ? isPhrase : /\s/.test(clean),
      prioritized: false,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    this.save();
    return { entry, duplicate: false };
  }

  addMany(userId, triggers, { roomId = null } = {}) {
    const added = [];
    const skipped = [];
    const invalid = [];
    for (const raw of triggers) {
      const clean = String(raw || '').trim().replace(/^["']|["']$/g, '').trim();
      if (!clean) continue;
      if (clean.length > 120) {
        invalid.push(clean.slice(0, 40));
        continue;
      }
      try {
        const result = this.add(userId, clean, { roomId });
        if (result.duplicate) skipped.push(result.entry.trigger);
        else added.push(result.entry);
      } catch (error) {
        invalid.push(error.message);
        if (this.list(userId, roomId).length >= 50) break;
      }
    }
    return { added, skipped, invalid };
  }

  _resolveIndex(userId, target, roomId = null) {
    const scoped = this.list(userId, roomId);
    if (!scoped.length) return { scoped, scopedIndex: -1, entry: null };
    const raw = String(target || '').trim().replace(/^["']|["']$/g, '').trim();
    if (!raw) return { scoped, scopedIndex: -1, entry: null };
    if (/^\d+$/.test(raw)) {
      const idx = Number.parseInt(raw, 10) - 1;
      if (idx >= 0 && idx < scoped.length) return { scoped, scopedIndex: idx, entry: scoped[idx] };
    }
    const lower = raw.toLowerCase();
    const idx = scoped.findIndex((item) => item.id.toLowerCase() === lower || item.trigger.toLowerCase() === lower);
    return { scoped, scopedIndex: idx, entry: idx >= 0 ? scoped[idx] : null };
  }

  remove(userId, target, roomId = null) {
    const { entry } = this._resolveIndex(userId, target, roomId);
    if (!entry) return null;
    const globalIndex = this.entries.indexOf(entry);
    if (globalIndex < 0) return null;
    this.entries.splice(globalIndex, 1);
    this.save();
    return entry;
  }

  edit(userId, target, newTrigger, roomId = null) {
    const clean = String(newTrigger || '').trim().replace(/^["']|["']$/g, '').trim();
    if (!clean || clean.length > 120) throw new RangeError('Highlight word or phrase must be 1–120 characters.');
    const { scoped, entry } = this._resolveIndex(userId, target, roomId);
    if (!entry) return null;
    const conflict = scoped.find((item) => item !== entry && item.trigger.toLowerCase() === clean.toLowerCase());
    if (conflict) throw new RangeError(`"${clean}" is already in your highlight list.`);
    const previous = entry.trigger;
    entry.trigger = clean;
    entry.isPhrase = /\s/.test(clean);
    entry.updatedAt = new Date().toISOString();
    this.save();
    return { previous, entry };
  }

  prioritize(userId, listNumber, newPosition = 1, roomId = null) {
    const { scoped, scopedIndex, entry } = this._resolveIndex(userId, listNumber, roomId);
    if (!entry) return null;
    const clampedPos = Math.max(1, Math.min(Number.parseInt(String(newPosition || 1), 10) || 1, scoped.length));
    const targetScopedIndex = clampedPos - 1;
    const targetEntry = scoped[targetScopedIndex];

    const fromGlobal = this.entries.indexOf(entry);
    if (fromGlobal < 0) return null;
    this.entries.splice(fromGlobal, 1);

    const toGlobal = targetEntry && targetEntry !== entry ? this.entries.indexOf(targetEntry) : fromGlobal;
    const insertAt = targetScopedIndex > scopedIndex && targetEntry && targetEntry !== entry ? toGlobal + 1 : Math.max(0, toGlobal);
    entry.prioritized = true;
    this.entries.splice(insertAt, 0, entry);
    this.save();
    return { entry, fromPosition: scopedIndex + 1, toPosition: clampedPos };
  }

  clear(userId, roomId = null) {
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => !this._matchesScope(entry, userId, roomId));
    const removed = before - this.entries.length;
    if (removed > 0) this.save();
    return removed;
  }

  match(roomId, authorId, content) {
    const text = String(content || '').toLowerCase();
    if (!text) return [];
    const author = authorId ? String(authorId) : null;
    const words = new Set(text.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean));
    const byUser = new Map();

    for (const entry of this.entries) {
      if (author && entry.userId === author) continue;
      if (roomId && entry.roomId && entry.roomId !== String(roomId)) continue;
      const needle = entry.trigger.toLowerCase();
      const hit = (entry.isPhrase || /\s/.test(needle)) ? text.includes(needle) : words.has(needle);
      if (!hit) continue;
      let list = byUser.get(entry.userId);
      if (!list) byUser.set(entry.userId, list = []);
      if (list.length < 5) list.push(entry);
    }

    return Array.from(byUser.entries()).map(([userId, entries]) => ({ userId, entries }));
  }
}

export class ReminderStore {
  constructor(client, directory = dataDir) { this.client = client; this.file = new JsonFile('reminders.json', [], directory); this.entries = []; this.timers = new Map(); }
  load() {
    const data = this.file.read();
    this.entries = Array.isArray(data) ? data.filter((entry) => entry?.id && entry?.userId && entry?.laneId && Number.isFinite(Date.parse(entry.dueAt))) : [];
    for (const entry of this.entries) if (!entry.failed) this.schedule(entry);
  }
  save() { this.file.write(this.entries); }
  list(userId) { return this.entries.filter((entry) => entry.userId === String(userId)).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)); }
  create({ userId, laneId, text, dueAt }) {
    if (this.list(userId).length >= 20) throw new RangeError('You can have at most 20 active reminders.');
    const entry = { id: randomUUID().slice(0, 8), userId: String(userId), laneId: String(laneId), text: String(text).slice(0, 500), dueAt: new Date(dueAt).toISOString(), createdAt: new Date().toISOString() };
    this.entries.push(entry); this.save(); this.schedule(entry); return entry;
  }
  cancel(userId, id) {
    const index = this.entries.findIndex((entry) => entry.userId === String(userId) && entry.id === String(id));
    if (index < 0) return false;
    clearTimeout(this.timers.get(String(id))); this.timers.delete(String(id)); this.entries.splice(index, 1); this.save(); return true;
  }
  schedule(entry) {
    clearTimeout(this.timers.get(entry.id));
    const delay = Math.max(0, Math.min(Date.parse(entry.dueAt) - Date.now(), 2_147_000_000));
    const timer = setTimeout(async () => {
      this.timers.delete(entry.id);
      const current = this.entries.find((item) => item.id === entry.id);
      if (!current) return;
      if (Date.parse(current.dueAt) > Date.now()) return this.schedule(current);
      try {
        await this.client.sendContainer(current.laneId, { title: '⏰ Reminder', description: `**${escapeMarkdown(current.text).replaceAll('@', '@​')}**`, footer: `Reminder ID ${current.id}` });
        this.entries = this.entries.filter((item) => item.id !== entry.id); this.save();
      } catch (error) {
        current.attempts = (current.attempts || 0) + 1;
        console.error(`[Reminder:${current.id}] Delivery attempt ${current.attempts} failed: ${error?.message || 'unknown error'}`);
        if (current.attempts < 5) {
          const retryDelayMs = Math.min(30_000 * (2 ** (current.attempts - 1)), 600_000);
          current.dueAt = new Date(Date.now() + retryDelayMs).toISOString();
          this.save(); this.schedule(current);
        } else {
          current.failed = true; current.failedAt = new Date().toISOString(); this.save();
        }
      }
    }, delay);
    timer.unref?.(); this.timers.set(entry.id, timer);
  }
  close() { for (const timer of this.timers.values()) clearTimeout(timer); this.timers.clear(); }
}

export function parseDuration(value) {
  const match = String(value || '').toLowerCase().match(/^(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match.slice(1).some(Boolean)) return null;
  const seconds = Number(match[1] || 0) * 604800 + Number(match[2] || 0) * 86400 + Number(match[3] || 0) * 3600 + Number(match[4] || 0) * 60 + Number(match[5] || 0);
  return seconds > 0 && seconds <= 30 * 86400 ? seconds : null;
}
