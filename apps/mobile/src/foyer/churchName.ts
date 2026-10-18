import { useEffect, useState } from 'react';

import { useAuth } from '@hooks/useAuth';
import { fetchChurches, type ChurchRecord } from '@services/foyerService';
import type { AuthUser } from '../types/auth';

type ChurchUser = Pick<AuthUser, 'church' | 'churchId'> | null | undefined;

/**
 * The member's own church name for "The Foyer" header line and the Discover "From …" subtitle. Uses the profile's
 * `church.name`; otherwise looks `churchId` up in the churches list. Null when no church is picked (frame 245 hides the
 * line). Never falls back to a hardcoded church.
 */
export const memberChurchName = (user: ChurchUser, churches?: ReadonlyArray<Pick<ChurchRecord, 'id' | 'name'>> | null) => {
  const own = user?.church?.name?.trim();
  if (own) {
    return own;
  }
  const id = user?.churchId ?? user?.church?.id ?? null;
  if (id == null || !churches) {
    return null;
  }
  return churches.find((church) => String(church.id) === String(id))?.name?.trim() || null;
};

let churchListCache: ChurchRecord[] | null = null;

/** Test hook: forget the cached churches list. */
export const resetChurchNameCache = () => {
  churchListCache = null;
};

/** Hook form of `memberChurchName`. Fetches the churches list only when the profile has an id but no name. */
export const useMemberChurchName = (): string | null => {
  const { user } = useAuth();
  const direct = memberChurchName(user, null);
  const needsLookup = !direct && user?.churchId != null;
  const [churches, setChurches] = useState<ChurchRecord[] | null>(churchListCache);

  useEffect(() => {
    if (!needsLookup || churchListCache) {
      return;
    }
    let live = true;
    fetchChurches('')
      .then((list) => {
        churchListCache = list;
        if (live) {
          setChurches(list);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [needsLookup]);

  return direct ?? (needsLookup ? memberChurchName(user, churches ?? churchListCache) : null);
};
