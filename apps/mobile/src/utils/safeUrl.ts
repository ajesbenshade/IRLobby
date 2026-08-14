const IRLOBBY_HOSTS = new Set(['irlobby.com', 'www.irlobby.com']);
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

export function isAllowedIrlobbyUrl(value: string): boolean {
  const parsed = parseHttpsUrl(value);
  return Boolean(parsed && IRLOBBY_HOSTS.has(parsed.hostname));
}

export function isAllowedStripeUrl(value: string): boolean {
  const parsed = parseHttpsUrl(value);
  if (!parsed) {
    return false;
  }
  return (
    parsed.hostname === 'stripe.com' ||
    parsed.hostname.endsWith('.stripe.com')
  );
}

export function isAllowedTwitterOAuthUrl(value: string): boolean {
  const parsed = parseHttpsUrl(value);
  if (!parsed) {
    return false;
  }
  return (
    TWITTER_HOSTS.has(parsed.hostname) ||
    parsed.hostname.endsWith('.twitter.com') ||
    parsed.hostname.endsWith('.x.com')
  );
}
