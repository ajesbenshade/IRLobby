import { useEffect, useState } from 'react';

import { useAuth } from '@hooks/useAuth';
import { fetchChurches, type ChurchRecord } from '@services/foyerService';
import type { AuthUser } from '../types/auth';
import { churchHasWebsiteCalendar } from './churchCalendar';

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
let churchListRequest: Promise<ChurchRecord[]> | null = null;

/** Test hook: forget the cached churches list. */
export const resetChurchNameCache = () => {
  churchListCache = null;
  churchListRequest = null;
};

/** One shared request: the header and the host form ask at the same time. */
const loadChurchList = (): Promise<ChurchRecord[]> => {
  if (!churchListRequest) {
    churchListRequest = fetchChurches('')
      .then((list) => {
        churchListCache = list;
        return list;
      })
      .catch((error) => {
        churchListRequest = null;
        throw error;
      });
  }
  return churchListRequest;
};

/** The churches list (shared, cached for the session), fetched only while `needed`. */
const useChurchList = (needed: boolean): ChurchRecord[] | null => {
  const [churches, setChurches] = useState<ChurchRecord[] | null>(churchListCache);

  useEffect(() => {
    if (!needed || churchListCache) {
      return;
    }
    let live = true;
    loadChurchList()
      .then((list) => {
        if (live) {
          setChurches(list);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [needed]);

  return churches ?? churchListCache;
};

/** The churches-list entry for the member's church id (profile `churchId`, else `church.id`). */
export const memberChurchEntry = (user: ChurchUser, churches?: ReadonlyArray<ChurchRecord> | null): ChurchRecord | null => {
  const id = user?.churchId ?? user?.church?.id ?? null;
  if (id == null || !churches) {
    return null;
  }
  return churches.find((church) => String(church.id) === String(id)) ?? null;
};

/** Hook form of `memberChurchName`. Fetches the churches list only when the profile has an id but no name. */
export const useMemberChurchName = (): string | null => {
  const { user } = useAuth();
  const direct = memberChurchName(user, null);
  const needsLookup = !direct && user?.churchId != null;
  const churches = useChurchList(needsLookup);
  return direct ?? (needsLookup ? memberChurchName(user, churches) : null);
};

/**
 * Whether the member's church has a website calendar: the profile/login church object, or the churches-list entry for
 * their church id. The list is fetched only when the profile church doesn't already say true.
 */
export const memberChurchHasWebsiteCalendar = (user: ChurchUser, churches?: ReadonlyArray<ChurchRecord> | null): boolean =>
  churchHasWebsiteCalendar(user?.church) || churchHasWebsiteCalendar(memberChurchEntry(user, churches));

export const useMemberChurchHasWebsiteCalendar = (): boolean => {
  const { user } = useAuth();
  const direct = churchHasWebsiteCalendar(user?.church);
  const hasId = (user?.churchId ?? user?.church?.id) != null;
  const churches = useChurchList(!direct && hasId);
  return direct || memberChurchHasWebsiteCalendar(user, churches);
};
