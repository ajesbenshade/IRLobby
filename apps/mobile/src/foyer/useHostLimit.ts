import { useEffect, useState } from 'react';

import { hostLimitState, type HostLimitState } from '@foyer/hostLimit';
import { useAuth } from '@hooks/useAuth';

/** setTimeout's ceiling is ~24.8 days; re-check at least daily. */
const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

/** The member's weekly host limit, re-evaluated when the next slot opens (so Gatherings + stops opening the sheet). */
export const useHostLimit = (): HostLimitState => {
  const { user } = useAuth();
  const [, setTick] = useState(0);
  const state = hostLimitState(user);
  const opensAtMs = state.blocked ? state.opensAt.getTime() : null;

  useEffect(() => {
    if (opensAtMs == null) {
      return undefined;
    }
    const wait = Math.min(MAX_WAIT_MS, Math.max(0, opensAtMs - Date.now()) + 1000);
    const timer = setTimeout(() => setTick((value) => value + 1), wait);
    return () => clearTimeout(timer);
  }, [opensAtMs]);

  return state;
};
