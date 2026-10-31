import { io } from 'socket.io-client';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config, validateConfig } from './config.js';
import { VeiledClient } from './api.js';
import { AfkStore, ReminderStore } from './state.js';
import { isGatewayEventName, isReplayableGatewayEventName } from './events/names.js';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export class Bot {
  constructor(options = {}) {
    this.config = options.config || config;
    this.gatewayFactory = options.gatewayFactory || io;
    this.installSignalHandlers = options.installSignalHandlers !== false;
    this.api = options.api || new VeiledClient(this.config.token, this.config.apiUrl);
    this.afk = new AfkStore();
    this.reminders = new ReminderStore(this.api);
    this.user = null;
    this.application = null;
    this.gateway = null;
    this.gatewayListeners = new Map();
    this.gatewayModules = new Map();
    this.boundGatewayEvents = new Set();
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
      if (isGatewayEventName(event.name)) {
        let handlers = this.gatewayModules.get(event.name);
        if (!handlers) this.gatewayModules.set(event.name, handlers = []);
        handlers.push(event);
        this.ensureGatewayEventBound(event.name);
        continue;
      }
      const handler = (...args) => Promise.resolve(event.execute(this, ...args)).catch((error) => {
        console.error(`[Gateway] ${event.name} handler failed: ${error?.message || 'unknown error'}`);
      });
      (event.once ? this.gateway.once.bind(this.gateway) : this.gateway.on.bind(this.gateway))(event.name, handler);
    }
  }

  ensureGatewayEventBound(eventName) {
    if (!this.gateway || this.boundGatewayEvents.has(eventName)) return;
    this.boundGatewayEvents.add(eventName);
    const handler = (payload) => {
      void this.dispatchGatewayEvent(eventName, payload);
    };
    this.gateway.on(eventName, handler);
    const lower = eventName.toLowerCase();
    if (lower !== eventName) {
      this.gateway.on(lower, handler);
    }
  }

  async dispatchGatewayEvent(eventName, payload) {
    try {
      for (const event of this.gatewayModules.get(eventName) || []) await event.execute(this, payload);
      for (const listener of this.gatewayListeners.get(eventName) || []) await listener(payload);
    } catch (error) {
      console.error(`[Gateway] ${eventName} handler failed: ${error?.message || 'unknown error'}`);
      return false;
    }

    if (payload?.gateway_event_replayed === true
      && isReplayableGatewayEventName(eventName)
      && typeof payload.gateway_event_id === 'string') {
      try {
        const result = await this.acknowledgeReplay(payload.gateway_event_id);
        if (!result.success) console.error(`[Gateway] Replay acknowledgement rejected: ${result.error || 'unknown error'}`);
      } catch (error) {
        console.error(`[Gateway] Replay acknowledgement failed: ${error?.message || 'unknown error'}`);
      }
    }
    return true;
  }

  acknowledgeReplay(eventId) {
    if (!this.gateway?.connected) return Promise.reject(new Error('The bot gateway is not connected.'));
    if (typeof eventId !== 'string' || !eventId) return Promise.reject(new TypeError('eventId is required.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Replay acknowledgement timed out.')), 5000);
      this.gateway.emit('gateway:ack', { eventId }, (result) => {
        clearTimeout(timer);
        if (!result || typeof result.success !== 'boolean') return reject(new Error('Invalid replay acknowledgement response.'));
        resolve(result);
      });
    });
  }

  acknowledgeReplayEvent(payload) {
    if (typeof payload?.gateway_event_id !== 'string') return Promise.reject(new TypeError('Replay payload has no gateway_event_id.'));
    return this.acknowledgeReplay(payload.gateway_event_id);
  }

  onGateway(eventName, listener) {
    if (!isGatewayEventName(eventName)) throw new TypeError(`Unsupported Veiled gateway event: ${eventName}`);
    if (typeof listener !== 'function') throw new TypeError('Gateway listener must be a function.');
    let listeners = this.gatewayListeners.get(eventName);
    if (!listeners) this.gatewayListeners.set(eventName, listeners = new Set());
    listeners.add(listener);
    this.ensureGatewayEventBound(eventName);
    return () => this.offGateway(eventName, listener);
  }

  offGateway(eventName, listener) {
    const listeners = this.gatewayListeners.get(eventName);
    if (!listeners?.delete(listener)) return false;
    if (listeners.size === 0) this.gatewayListeners.delete(eventName);
    return true;
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
    validateConfig(this.config);
    this.afk.load();
    this.reminders.load();
    const identity = await this.api.getMe();
    this.user = identity?.user;
    this.application = identity?.application;
    if (!this.user?.id) throw new Error('Veiled did not return a bot user for this token.');
    const gatewayInfo = this.config.gatewayUrl ? null : await this.api.getGateway();
    const gatewayUrl = this.config.gatewayUrl || gatewayInfo?.url;
    if (!gatewayUrl) throw new Error('Veiled did not return a gateway URL.');
    this.gateway = this.gatewayFactory(gatewayUrl, {
      auth: {
        token: `Bot ${this.api.token}`,
        intents: this.config.gatewayIntents,
        shard: [...this.config.shard],
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 15000,
      autoConnect: false,
    });
    for (const eventName of this.gatewayListeners.keys()) this.ensureGatewayEventBound(eventName);
    await this.loadCommands();
    await this.loadEvents();
    this.startTime = Date.now();
    if (typeof this.gateway.onAny === 'function') {
      this.gateway.onAny((eventName, payload) => {
        if (['connect', 'disconnect', 'connect_error', 'ping', 'pong'].includes(eventName)) return;
        const upper = String(eventName).toUpperCase();
        if (upper !== eventName && isGatewayEventName(upper) && !this.boundGatewayEvents.has(eventName)) {
          void this.dispatchGatewayEvent(upper, payload);
        }
      });
    }
    this.gateway.connect();
    console.log(`VeiledBot connected as ${this.user.username || this.user.id}; loaded ${this.commands.size} commands.`);
    console.log(`[Config] Command prefix: "${this.config.commandPrefix}" (also accepting "!" as fallback)`);
    const hasMessageContent = (this.config.gatewayIntents & 8) !== 0;
    if (!hasMessageContent) {
      console.warn(`[Warning] Gateway intent MESSAGE_CONTENT is NOT enabled in VEILED_BOT_INTENTS.`);
      console.warn(`[Warning] Without MESSAGE_CONTENT, Veiled will not send message text for prefix commands.`);
      console.warn(`[Warning] Add VEILED_BOT_INTENTS to your .env file with MESSAGE_CONTENT included.`);
    } else {
      console.log(`[Gateway] Gateway intents: ${this.config.gatewayIntents} (MESSAGE_CONTENT enabled)`);
    }
    const shutdown = () => {
      this.reminders.close();
      this.gateway?.disconnect();
      process.exit(0);
    };
    if (this.installSignalHandlers) {
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    }
  }
}
