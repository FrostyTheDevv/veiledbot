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
