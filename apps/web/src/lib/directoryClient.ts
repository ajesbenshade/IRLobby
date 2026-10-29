import { apiRequest } from '@/lib/queryClient';
import {
  DIRECTORY_PAGE_CAP,
  directoryQuery,
  isMissingDirectoryStatus,
  mergeDirectoryMembers,
  normalizeDirectoryPage,
  type DirectoryMember,
} from '@shared/directory';
import { API_ROUTE_BUILDERS } from '@shared/schema';

export type DirectoryLoad = {
  results: DirectoryMember[];
  count: number | null;
  unavailable: boolean;
  truncated: boolean;
};

export type MemberCard = {
  id: number | string;
  firstName: string;
  avatarUrl: string | null;
  bio: string | null;
  friendship: 'none' | 'friends' | 'pending_outgoing' | 'pending_incoming' | 'self';
  visible: boolean;
  email?: string;
  phone?: string;
  birthdayMonth: number | null;
  birthdayDay: number | null;
};

const statusOf = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

const readJson = async (response: Response) => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
};

const getJson = async (path: string) => readJson(await apiRequest('GET', path));

/** Same contract as the native client. See `@shared/directory`. */
export async function fetchDirectory(query = ''): Promise<DirectoryLoad> {
  try {
    const pages: DirectoryMember[][] = [];
    let path: string | null = directoryQuery({ q: query });
    let count: number | null = null;
    let fetched = 0;
    while (path && fetched < DIRECTORY_PAGE_CAP) {
      const page = normalizeDirectoryPage(await getJson(path));
      pages.push(page.results);
      count = page.count ?? count;
      path = page.nextPath;
      fetched += 1;
    }
    return {
      results: mergeDirectoryMembers(pages),
      count,
      unavailable: false,
      truncated: Boolean(path),
    };
  } catch (error) {
    if (isMissingDirectoryStatus(statusOf(error))) {
      return { results: [], count: null, unavailable: true, truncated: false };
    }
    throw error;
  }
}

export async function fetchMemberCard(userId: number | string): Promise<MemberCard | null> {
  try {
    const raw = await getJson(`/api/users/${userId}/profile/`);
    const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
    if (!record || record.id == null) return null;
    const birthday =
      record.birthday && typeof record.birthday === 'object'
        ? (record.birthday as { month?: unknown; day?: unknown })
        : null;
    const month = birthday && typeof birthday.month === 'number' ? birthday.month : null;
    const day = birthday && typeof birthday.day === 'number' ? birthday.day : null;
    const friendship = record.friendship;
    return {
      id: record.id as number | string,
      firstName: typeof record.first_name === 'string' ? record.first_name : '',
      avatarUrl:
        typeof record.avatar_url === 'string' && record.avatar_url ? record.avatar_url : null,
      bio: typeof record.bio === 'string' ? record.bio : null,
      friendship:
        friendship === 'friends' ||
        friendship === 'pending_outgoing' ||
        friendship === 'pending_incoming' ||
        friendship === 'self'
          ? friendship
          : 'none',
      visible: record.visible !== false,
      ...(typeof record.email === 'string' ? { email: record.email } : {}),
      ...(typeof record.phone === 'string' ? { phone: record.phone } : {}),
      birthdayMonth: month,
      birthdayDay: day,
    };
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

export async function sendFriendRequest(userId: number | string) {
  await apiRequest('POST', '/api/friends/requests/', { user_id: Number(userId) });
}

export async function reportMember(userId: number | string) {
  await apiRequest('POST', `/api/users/${userId}/report/`, { reason: 'other' });
}

export async function blockMember(userId: number | string) {
  await apiRequest('POST', API_ROUTE_BUILDERS.moderationBlock(userId));
}

export async function sendDirectMessage(userId: number | string, message: string) {
  const opened = await readJson(
    await apiRequest('POST', '/api/messages/direct/', { user_id: Number(userId) }),
  );
  const conversationId =
    opened && typeof opened === 'object' ? (opened as { id?: number | string }).id : undefined;
  if (conversationId == null) {
    throw new Error('Could not open a conversation.');
  }
  await apiRequest('POST', API_ROUTE_BUILDERS.conversationMessages(conversationId), { message });
}

/**
 * `POST /api/directory/wishes/` is specified and not implemented. A missing route
 * falls back to a plain 1:1. The text names the child. Chat does not store a card style.
 */
export async function sendChildBirthdayWish(input: {
  parentUserId: number | string;
  childId: number | string;
  childFirstName: string;
  message: string;
}) {
  try {
    await apiRequest('POST', '/api/directory/wishes/', {
      child_id: input.childId,
      message: input.message,
    });
  } catch (error) {
    if (!isMissingDirectoryStatus(statusOf(error))) throw error;
    await sendDirectMessage(input.parentUserId, input.message);
  }
}
