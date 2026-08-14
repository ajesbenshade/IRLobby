const TWITTER_HOSTS = new Set([
  'api.twitter.com',
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
]);

export function parseHttpsUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isAllowedTwitterOAuthUrl(value: string): boolean {
  const parsed = parseHttpsUrl(value);
  if (!parsed) {
    return false;
  }
  return TWITTER_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith('.twitter.com') || parsed.hostname.endsWith('.x.com');
}
