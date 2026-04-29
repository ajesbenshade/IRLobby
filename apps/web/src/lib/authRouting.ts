export interface AuthRouteState {
  isAuthenticated: boolean;
  isLoading: boolean;
  needsOnboarding: boolean;
}

export type AuthRouteKind = 'public-home' | 'protected' | 'onboarding';

const DEFAULT_AUTHENTICATED_PATH = '/app';

export function getSafePostAuthRedirect(
  redirectValue: string | null | undefined,
  fallback = DEFAULT_AUTHENTICATED_PATH,
) {
  const target = redirectValue?.trim();
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return fallback;
  }

  try {
    const parsed = new URL(target, 'https://irlobby.local');
    if (parsed.origin !== 'https://irlobby.local' || !parsed.pathname.startsWith('/app')) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildLoginRedirect(currentPath: string) {
  const safeTarget = getSafePostAuthRedirect(currentPath);
  return `/?redirect=${encodeURIComponent(safeTarget)}#auth`;
}

export function getAuthRedirect(kind: AuthRouteKind, state: AuthRouteState) {
  if (state.isLoading) {
    return null;
  }

  if (kind === 'protected') {
    if (!state.isAuthenticated) {
      return '/';
    }

    return state.needsOnboarding ? '/onboarding' : null;
  }

  if (kind === 'onboarding') {
    if (!state.isAuthenticated) {
      return '/';
    }

    return state.needsOnboarding ? null : '/app';
  }

  if (!state.isAuthenticated) {
    return null;
  }

  return state.needsOnboarding ? '/onboarding' : '/app';
}
