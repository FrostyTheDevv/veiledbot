import { io } from 'socket.io-client';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config, validateConfig } from './config.js';
import { VeiledClient } from './api.js';
import { AfkStore, ReminderStore } from './state.js';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export class Bot {
  constructor() {
    this.config = config;
    this.api = new VeiledClient(config.token, config.apiUrl);
    this.afk = new AfkStore();
    this.reminders = new ReminderStore(this.api);
    this.user = null;
    this.application = null;
    this.gateway = null;
    this.commands = new Map();
    this.aliases = new Map();
    this.cooldowns = new Map();
    this.laneCache = new Map();
    this.startTime = null;
  }

  getFiles(dir) {
    if (!dir || !readdirSync) return [];
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return this.getFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
    }).sort();
  }

  async loadCommands(commandsDir = join(projectRoot, 'src', 'commands')) {
    const commands = new Map();
    const aliases = new Map();
    for (const filePath of this.getFiles(commandsDir)) {
      const module = await import(pathToFileURL(filePath).href);
      const command = module.default || module;
      if (!command?.name || typeof command.execute !== 'function') continue;
      const name = command.name.toLowerCase();
      if (commands.has(name)) throw new Error(`Duplicate command name: ${name}`);
      commands.set(name, command);
      for (const alias of command.aliases || []) {
        const normalized = String(alias).toLowerCase();
        if (commands.has(normalized) || aliases.has(normalized)) throw new Error(`Duplicate command alias: ${normalized}`);
        aliases.set(normalized, name);
      }
    }
    this.commands = commands;
    this.aliases = aliases;
    return commands.size;
  }

  async loadEvents(eventsDir = join(projectRoot, 'src', 'events')) {
    for (const filePath of this.getFiles(eventsDir)) {
      const module = await import(pathToFileURL(filePath).href);
      const event = module.default || module;
      if (!event?.name || typeof event.execute !== 'function') continue;
      const handler = (...args) => Promise.resolve(event.execute(this, ...args)).catch((error) => {
        console.error(`[Gateway] ${event.name} handler failed: ${error?.message || 'unknown error'}`);
      });
      (event.once ? this.gateway.once.bind(this.gateway) : this.gateway.on.bind(this.gateway))(event.name, handler);
    }
  }

  async getLaneInfo(laneId) {
    if (!laneId) return null;
    const cached = this.laneCache.get(laneId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const data = await this.api.getLane(laneId);
    const lane = data?.lane || data?.data || data;
    const room = lane?.Room || lane?.room || {};
    const info = { id: lane.id, name: lane.name, type: lane.type, topic: lane.topic, roomId: lane.roomId || room.id, roomName: room.name || 'Unknown room' };
    this.laneCache.set(laneId, { value: info, expiresAt: Date.now() + 60_000 });
    if (this.laneCache.size > 1000) this.laneCache.delete(this.laneCache.keys().next().value);
    return info;
  }

  consumeCooldown(command, userId) {
    const now = Date.now();
    for (const [key, expiresAt] of this.cooldowns) if (expiresAt <= now) this.cooldowns.delete(key);
    const key = `${command.name}:${userId}`;
    const expiresAt = this.cooldowns.get(key) || 0;
    if (expiresAt > now) return Math.ceil((expiresAt - now) / 1000);
    if (command.cooldown) this.cooldowns.set(key, now + command.cooldown * 1000);
    if (this.cooldowns.size > 5000) this.cooldowns.clear();
    return 0;
  }

  async start() {
    validateConfig();
    this.afk.load();
    this.reminders.load();
    const identity = await this.api.getMe();
    this.user = identity?.user;
    this.application = identity?.application;
    if (!this.user?.id) throw new Error('Veiled did not return a bot user for this token.');
    const gatewayInfo = this.config.gatewayUrl ? null : await this.api.getGateway();
    const gatewayUrl = this.config.gatewayUrl || gatewayInfo?.url;
    if (!gatewayUrl) throw new Error('Veiled did not return a gateway URL.');
    this.gateway = io(gatewayUrl, {
      auth: { token: `Bot ${this.api.token}` },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 15000,
    });
    await this.loadCommands();
    await this.loadEvents();
    this.startTime = Date.now();
    console.log(`VeiledBot connected as ${this.user.username || this.user.id}; loaded ${this.commands.size} commands.`);
    const shutdown = () => {
      this.reminders.close();
      this.gateway?.disconnect();
      process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}
