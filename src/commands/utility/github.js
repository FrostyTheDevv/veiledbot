import { safeText } from '../../commandUtils.js';

const cache = new Map();
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPOSITORY_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;

function githubWebUrl(value, fallback) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname.toLowerCase() === 'github.com' && !url.username && !url.password) return url.href;
  } catch { /* Fall back to the canonical URL for the validated target. */ }
  return fallback;
}

export function parseGitHubTarget(input) {
  let value = String(input || '').trim();
  if (!value || value.length > 250) return null;
  value = value.replace(/^@/, '');

  if (/^https?:\/\//i.test(value)) {
    let parsed;
    try { parsed = new URL(value); } catch { return null; }
    if (parsed.hostname.toLowerCase() !== 'github.com' || !['http:', 'https:'].includes(parsed.protocol)) return null;
    value = parsed.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
  }

  const parts = value.split('/');
  if (parts.length === 1 && USERNAME_PATTERN.test(parts[0])) {
    return { kind: 'user', path: `/users/${encodeURIComponent(parts[0])}`, label: parts[0] };
  }
  if (parts.length === 2 && USERNAME_PATTERN.test(parts[0]) && REPOSITORY_PATTERN.test(parts[1])) {
    return { kind: 'repository', path: `/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`, label: `${parts[0]}/${parts[1]}` };
  }
  return null;
}

async function fetchGitHub(target, fetchImpl) {
  const cached = cache.get(target.path);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetchImpl(`https://api.github.com${target.path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'VeiledBot',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (response.status === 429 || remaining === '0') throw new Error('GitHub’s public API rate limit was reached. Try again later.');
  }
  if (response.status === 404) throw new Error(`No public GitHub ${target.kind} was found for that name.`);
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}. Try again shortly.`);

  const value = await response.json();
  cache.set(target.path, { value, expiresAt: Date.now() + 60_000 });
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return value;
}

export default {
  name: 'github', category: 'utility', description: 'Look up a public GitHub user or repository.', usage: '<username | owner/repo | github.com URL>', cooldown: 5,
  async execute({ client, message, args, bot }) {
    const target = parseGitHubTarget(args.join(' '));
    if (!target) return client.sendContainer(message.laneId, {
      title: 'Check the GitHub lookup',
      description: 'Use a public username (`!github torvalds`), repository (`!github microsoft/vscode`), or a github.com profile/repository URL.',
    }, { replyToId: message.id });

    try {
      const data = await fetchGitHub(target, bot?.fetch || globalThis.fetch);
      if (target.kind === 'user') {
        const description = [data.name, data.bio].filter(Boolean).map((part) => safeText(part, 400)).join('\n');
        return client.sendContainer(message.laneId, {
          title: safeText(data.name || data.login, 100),
          description: `${description ? `${description}\n\n` : ''}[@${safeText(data.login, 40)}](${githubWebUrl(data.html_url, `https://github.com/${encodeURIComponent(data.login)}`)})`,
          sections: [{ content: `**Public repositories**: ${data.public_repos ?? 0}\n**Followers**: ${data.followers ?? 0}\n**GitHub user since**: ${String(data.created_at || '').slice(0, 10) || 'Unknown'}` }],
          linkButtons: [{ label: 'Open GitHub profile', url: githubWebUrl(data.html_url, `https://github.com/${encodeURIComponent(data.login)}`) }],
          accentColor: 0x24292f,
        }, { replyToId: message.id });
      }

      const owner = data.owner?.login || target.label.split('/')[0];
      const details = [
        `**Owner**: ${safeText(owner, 40)}`,
        `**Language**: ${safeText(data.language || 'Not specified', 60)}`,
        `**Stars**: ${(data.stargazers_count || 0).toLocaleString()}`,
        `**Forks**: ${(data.forks_count || 0).toLocaleString()}`,
        `**Open issues**: ${(data.open_issues_count || 0).toLocaleString()}`,
        `**Last updated**: ${String(data.pushed_at || '').slice(0, 10) || 'Unknown'}`,
      ].join('\n');
      return client.sendContainer(message.laneId, {
        title: safeText(data.full_name || target.label, 100),
        description: `${safeText(data.description || 'No description provided.', 700)}\n\n[View repository](${githubWebUrl(data.html_url, `https://github.com/${target.label.split('/').map(encodeURIComponent).join('/')}`)})`,
        sections: [{ content: details }],
        ...(data.homepage && /^https:\/\//i.test(data.homepage) ? { linkButtons: [{ label: 'Project website', url: safeText(data.homepage, 500) }] } : {}),
        accentColor: 0x24292f,
      }, { replyToId: message.id });
    } catch (error) {
      const messageText = error?.name === 'TimeoutError'
        ? 'GitHub took too long to respond. Try again.'
        : safeText(error?.message || 'Could not reach GitHub right now.', 300);
      return client.sendContainer(message.laneId, { title: 'GitHub lookup failed', description: messageText }, { replyToId: message.id });
    }
  },
};
