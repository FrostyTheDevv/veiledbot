import { safeText } from '../../commandUtils.js';

const cache = new Map();

function cleanExcerpt(value, max = 800) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

export function parseWikipediaQuery(input) {
  const query = String(input || '').trim().replace(/\s+/g, ' ');
  return query.length > 0 && query.length <= 120 ? query : null;
}

async function searchWikipedia(query, fetchImpl) {
  const key = query.toLocaleLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL('https://en.wikipedia.org/w/rest.php/v1/search/page');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'VeiledBot/1.0 (https://veiled.lol)' },
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) return null;
  if (response.status === 429) throw new Error('Wikipedia is receiving too many requests. Try again shortly.');
  if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}. Try again shortly.`);

  const value = (await response.json()).pages?.[0] || null;
  cache.set(key, { value, expiresAt: Date.now() + 60_000 });
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return value;
}

export default {
  name: 'wikipedia', category: 'utility', description: 'Search English Wikipedia for an article.', aliases: ['wiki'], usage: '<search terms>', minArgs: 1, cooldown: 5,
  async execute({ client, message, args, bot }) {
    const query = parseWikipediaQuery(args.join(' '));
    if (!query) return client.sendContainer(message.laneId, {
      title: 'Search Wikipedia',
      description: 'Enter a search phrase up to 120 characters, such as `!wiki northern lights`.',
    }, { replyToId: message.id });

    try {
      const page = await searchWikipedia(query, bot?.fetch || globalThis.fetch);
      if (!page) return client.sendContainer(message.laneId, {
        title: 'No article found',
        description: `Wikipedia did not find an article for **${safeText(query, 120)}**.`,
      }, { replyToId: message.id });

      const slug = String(page.key || page.title || '').split('/').map(encodeURIComponent).join('/');
      const url = `https://en.wikipedia.org/wiki/${slug}`;
      const excerpt = cleanExcerpt(page.excerpt);
      return client.sendContainer(message.laneId, {
        title: safeText(page.title || 'Wikipedia result', 180),
        description: [page.description && safeText(page.description, 300), excerpt && safeText(excerpt, 800)].filter(Boolean).join('\n\n') || 'Open the article to read more.',
        linkButtons: [{ label: 'Read on Wikipedia', url }],
        footer: 'Search result from English Wikipedia. Article text is available under its published license.',
        accentColor: 0x6366f1,
      }, { replyToId: message.id });
    } catch (error) {
      const description = error?.name === 'TimeoutError'
        ? 'Wikipedia took too long to respond. Try again.'
        : safeText(error?.message || 'Could not reach Wikipedia right now.', 300);
      return client.sendContainer(message.laneId, { title: 'Wikipedia search failed', description }, { replyToId: message.id });
    }
  },
};
