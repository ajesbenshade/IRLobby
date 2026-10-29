import axios from 'axios';
import {
  DIRECTORY_PAGE_CAP,
  directoryQuery,
  isMissingDirectoryStatus,
  mergeDirectoryMembers,
  normalizeDirectoryPage,
  type DirectoryMember,
} from '@shared/directory';
import { API_ROUTE_BUILDERS } from '@shared/schema';

import { api } from './apiClient';
import { openDirectConversation } from './foyerService';

export type DirectoryLoad = {
  results: DirectoryMember[];
  count: number | null;
  unavailable: boolean;
  truncated: boolean;
};

const statusOf = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined;

const readPage = async (path: string) => {
  const response = await api.get(path);
  return normalizeDirectoryPage(response.data);
};

/**
 * GET /api/directory/. Follows `next` until the page cap so A–Z can cover a
 * church smaller than the server-search threshold. A missing route is
 * `unavailable` (Backend #73 not deployed).
 */
export const fetchDirectory = async (query = ''): Promise<DirectoryLoad> => {
  try {
    const pages: DirectoryMember[][] = [];
    let path: string | null = directoryQuery({ q: query });
    let count: number | null = null;
    let fetched = 0;
    while (path && fetched < DIRECTORY_PAGE_CAP) {
      const page = await readPage(path);
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
};

/**
 * Wish path. `POST /api/directory/wishes/` is specified and not implemented, so a
 * 404/405/501 falls back to the parent's existing 1:1. The text includes the
 * child's name. Chat has no birthday-card style field; `style` is sent and may be ignored.
 */
export const sendChildBirthdayWish = async (input: {
  parentUserId: number | string;
  childId: number | string;
  childFirstName: string;
  message: string;
}) => {
  try {
    await api.post('/api/directory/wishes/', {
      child_id: input.childId,
      message: input.message,
    });
    return;
  } catch (error) {
    if (!isMissingDirectoryStatus(statusOf(error))) throw error;
  }
  const conversation = await openDirectConversation(input.parentUserId);
  await api.post(API_ROUTE_BUILDERS.conversationMessages(conversation.id), {
    message: input.message,
    style: 'birthday_card',
    child_name: input.childFirstName,
  });
};
