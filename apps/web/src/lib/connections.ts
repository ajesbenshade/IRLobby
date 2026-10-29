import { apiRequest } from '@/lib/queryClient';
import {
  CONNECTIONS_COPY,
  ConnectionsClientError,
  connectionPaths,
  emptyConnections,
  isMissingConnectionsStatus,
  normalizeConnections,
  type ConnectionLists,
} from '@shared/connections';

export type ConnectionsResult = ConnectionLists & { unavailable: boolean };

const statusOf = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

/**
 * GET connections `{ gathering, praying }`.
 * Until that route is on the server, a 404 / 405 / 501 is an empty list (`unavailable`).
 * This does not call matches or prayers as a stand-in.
 */
export async function fetchConnections(): Promise<ConnectionsResult> {
  try {
    const response = await apiRequest('GET', connectionPaths.list());
    const data = (await response.json()) as unknown;
    return { ...normalizeConnections(data), unavailable: false };
  } catch (error) {
    if (isMissingConnectionsStatus(statusOf(error))) {
      return { ...emptyConnections(), unavailable: true };
    }
    throw new ConnectionsClientError(CONNECTIONS_COPY.error, statusOf(error));
  }
}
