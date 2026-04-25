export interface AuthRouteState {
  isAuthenticated: boolean;
  isLoading: boolean;
  needsOnboarding: boolean;
}

export type AuthRouteKind = 'public-home' | 'protected' | 'onboarding';

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