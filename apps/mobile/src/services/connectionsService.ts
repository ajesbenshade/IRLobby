import axios from 'axios';

import {
  CONNECTIONS_COPY,
  ConnectionsClientError,
  connectionPaths,
  emptyConnections,
  isMissingConnectionsStatus,
  normalizeConnections,
  type ConnectionLists,
} from '@shared/connections';

import { api } from './apiClient';

export type ConnectionsResult = ConnectionLists & { unavailable: boolean };

/**
 * GET connections `{ gathering, praying }`.
 * Until that route is on the server, a 404 / 405 / 501 is an empty list (`unavailable`).
 * This does not call matches or prayers as a stand-in.
 */
export const fetchConnections = async (): Promise<ConnectionsResult> => {
  try {
    const response = await api.get(connectionPaths.list());
    return { ...normalizeConnections(response.data), unavailable: false };
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (isMissingConnectionsStatus(status)) {
      return { ...emptyConnections(), unavailable: true };
    }
    throw new ConnectionsClientError(CONNECTIONS_COPY.error, status);
  }
};
