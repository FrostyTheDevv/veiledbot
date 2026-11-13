import { createContainer } from '../../containers.js';
import { safeText } from '../../commandUtils.js';

export const TIMEZONE_REGIONS = Object.freeze({
  americas: {
    label: 'Americas',
    zones: [
      { value: 'America/New_York', label: 'New York (Eastern)' },
      { value: 'America/Chicago', label: 'Chicago (Central)' },
      { value: 'America/Denver', label: 'Denver (Mountain)' },
      { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific)' },
      { value: 'America/Phoenix', label: 'Phoenix (MST)' },
      { value: 'America/Anchorage', label: 'Anchorage (Alaska)' },
      { value: 'Pacific/Honolulu', label: 'Honolulu (Hawaii)' },
      { value: 'America/Toronto', label: 'Toronto' },
      { value: 'America/Vancouver', label: 'Vancouver' },
      { value: 'America/Mexico_City', label: 'Mexico City' },
      { value: 'America/Sao_Paulo', label: 'São Paulo' },
      { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
    ],
  },
  europe_africa: {
    label: 'Europe & Africa',
    zones: [
      { value: 'Europe/London', label: 'London (GMT/BST)' },
      { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
      { value: 'Europe/Berlin', label: 'Berlin' },
      { value: 'Europe/Madrid', label: 'Madrid' },
      { value: 'Europe/Rome', label: 'Rome' },
      { value: 'Europe/Amsterdam', label: 'Amsterdam' },
      { value: 'Europe/Warsaw', label: 'Warsaw' },
      { value: 'Europe/Athens', label: 'Athens (EET)' },
      { value: 'Europe/Istanbul', label: 'Istanbul' },
      { value: 'Europe/Moscow', label: 'Moscow' },
      { value: 'Africa/Cairo', label: 'Cairo' },
      { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
      { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    ],
  },
  asia: {
    label: 'Asia & Middle East',
    zones: [
      { value: 'Asia/Dubai', label: 'Dubai (GST)' },
      { value: 'Asia/Riyadh', label: 'Riyadh' },
      { value: 'Asia/Karachi', label: 'Karachi (PKT)' },
      { value: 'Asia/Kolkata', label: 'Mumbai / New Delhi (IST)' },
      { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
      { value: 'Asia/Jakarta', label: 'Jakarta (WIB)' },
      { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
      { value: 'Asia/Manila', label: 'Manila (PHT)' },
      { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
      { value: 'Asia/Shanghai', label: 'Shanghai / Beijing (CST)' },
      { value: 'Asia/Seoul', label: 'Seoul (KST)' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    ],
  },
  oceania_utc: {
    label: 'Oceania & UTC',
    zones: [
      { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
      { value: 'Australia/Perth', label: 'Perth (AWST)' },
      { value: 'Australia/Adelaide', label: 'Adelaide (ACST)' },
      { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
      { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
      { value: 'Australia/Melbourne', label: 'Melbourne' },
      { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
      { value: 'Pacific/Fiji', label: 'Fiji' },
    ],
  },
});

export function formatTimeZone(timeZone, now = new Date()) {
  const value = String(timeZone || '').trim();
  if (!value || value.length > 100) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: value,
      dateStyle: 'full',
      timeStyle: 'long',
    });
    return {
      timeZone: formatter.resolvedOptions().timeZone,
      local: formatter.format(now),
      utc: now.toISOString(),
    };
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

export function inferRegionForZone(zone = '') {
  const normalized = String(zone || '').trim();
  for (const [key, group] of Object.entries(TIMEZONE_REGIONS)) {
    if (group.zones.some((entry) => entry.value.toLowerCase() === normalized.toLowerCase())) return key;
  }
  const prefix = normalized.split('/')[0]?.toLowerCase();
  if (prefix === 'america') return 'americas';
  if (prefix === 'europe' || prefix === 'africa') return 'europe_africa';
  if (prefix === 'asia') return 'asia';
  if (prefix === 'australia' || prefix === 'pacific' || normalized.toUpperCase() === 'UTC') return 'oceania_utc';
  return 'americas';
}

export function buildTimezoneCard({ regionKey = 'americas', timeZone, userName, now = new Date() } = {}) {
  const safeRegion = TIMEZONE_REGIONS[regionKey] ? regionKey : inferRegionForZone(timeZone);
  const region = TIMEZONE_REGIONS[safeRegion] || TIMEZONE_REGIONS.americas;
  const activeZone = timeZone || region.zones[0].value;
  const formatted = formatTimeZone(activeZone, now) || formatTimeZone(region.zones[0].value, now);

  const regionRow = {
    type: 1,
    components: [{
      type: 3,
      custom_id: 'veiledbot:tz:region',
      placeholder: 'Select a timezone region',
      options: Object.entries(TIMEZONE_REGIONS).map(([value, group]) => ({
        label: group.label,
        value,
        default: value === safeRegion,
      })),
    }],
  };

  const zoneOptions = [...region.zones];
  if (formatted && !zoneOptions.some((item) => item.value === formatted.timeZone)) {
    zoneOptions.unshift({ value: formatted.timeZone, label: formatted.timeZone });
  }

  const zoneRow = {
    type: 1,
    components: [{
      type: 3,
      custom_id: 'veiledbot:tz:zone',
      placeholder: `Select a timezone in ${region.label}`,
      options: zoneOptions.slice(0, 25).map(({ value, label }) => ({
        label: label.slice(0, 100),
        value,
        default: formatted?.timeZone === value,
      })),
    }],
  };

  return {
    title: userName ? `${safeText(userName, 60)}’s Timezone · ${formatted.timeZone}` : `Timezone · ${formatted.timeZone}`,
    description: `**Region:** ${region.label}\n**Local time**\n${safeText(formatted.local, 140)}\n\n**UTC**\n${formatted.utc}`,
    footer: 'Select a region or timezone below to update and save your timezone.',
    accentColor: 0x5865f2,
    actionRows: [regionRow, zoneRow],
  };
}

export function createTimezoneComponents(options = {}) {
  return createContainer(buildTimezoneCard(options));
}

export default {
  name: 'timezone',
  category: 'utility',
  description: 'Browse timezones by region or view the current time in an IANA time zone.',
  aliases: ['tz'],
  usage: '[Region or Area/City]',
  cooldown: 3,
  async execute({ bot, client, message, args }) {
    const rawInput = args.join(' ').trim();
    const userId = message?.author?.id;
    const savedZone = userId ? bot?.timezones?.get(userId) : null;

    if (!rawInput) {
      const initialZone = savedZone || 'America/New_York';
      const regionKey = inferRegionForZone(initialZone);
      const card = buildTimezoneCard({
        regionKey,
        timeZone: initialZone,
        userName: savedZone ? (message.author.displayName || message.author.username) : null,
      });
      return client.sendContainer(message.laneId, card, { replyToId: message.id });
    }

    const lower = rawInput.toLowerCase();
    const regionAliases = {
      americas: 'americas', america: 'americas', us: 'americas',
      europe: 'europe_africa', africa: 'europe_africa', 'europe_africa': 'europe_africa',
      asia: 'asia', middleeast: 'asia',
      oceania: 'oceania_utc', australia: 'oceania_utc', pacific: 'oceania_utc', utc: 'oceania_utc',
    };
    if (regionAliases[lower] && lower !== 'utc') {
      const regionKey = regionAliases[lower];
      const card = buildTimezoneCard({ regionKey, timeZone: TIMEZONE_REGIONS[regionKey].zones[0].value });
      return client.sendContainer(message.laneId, card, { replyToId: message.id });
    }

    const result = formatTimeZone(args[0]);
    if (!result) {
      return client.sendContainer(message.laneId, {
        title: 'Unknown time zone',
        description: 'Use an IANA name such as `America/New_York`, `Europe/Paris`, or `Asia/Tokyo`, or run `tz` with no arguments to pick a region from the dropdown.',
      }, { replyToId: message.id });
    }

    if (userId) bot?.timezones?.set(userId, result.timeZone);
    const card = buildTimezoneCard({
      regionKey: inferRegionForZone(result.timeZone),
      timeZone: result.timeZone,
      userName: userId ? (message.author?.displayName || message.author?.username) : null,
    });
    return client.sendContainer(message.laneId, card, { replyToId: message.id });
  },
};
