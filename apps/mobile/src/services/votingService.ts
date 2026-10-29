import axios from 'axios';

import {
  VOTING_COPY,
  VoteClientError,
  castPayload,
  isEmptyVotingDegrade,
  isMissingVoteStatus,
  normalizeVote,
  normalizeVoteCircles,
  normalizeVoteList,
  votePaths,
  type Vote,
  type VoteCircle,
  type VoteCreatePayload,
} from '@shared/voting';

import { api } from './apiClient';

export type VoteListResult = {
  votes: Vote[];
  unavailable: boolean;
};

const statusOf = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined;

const bodyOf = (error: unknown): unknown => (axios.isAxiosError(error) ? error.response?.data : undefined);

const messageOf = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback;
  const data = error.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  const record = data as Record<string, unknown>;
  if (typeof record.detail === 'string' && record.detail.trim()) return record.detail;
  if (typeof record.error === 'string' && record.error.trim()) return record.error;
  for (const entry of Object.values(record)) {
    if (Array.isArray(entry) && typeof entry[0] === 'string' && entry[0].trim()) return entry[0];
  }
  return fallback;
};

const raise = (error: unknown, fallback: string): never => {
  throw new VoteClientError(messageOf(error, fallback), statusOf(error));
};

/**
 * Thin voting client. Same bearer `api` client as Directory, Connections, and Circles.
 * List is `GET /api/votes/ballots/`. An empty list or a not-voting-member forbid
 * is the empty tab. A missing route still degrades the same way.
 */
export const fetchVotes = async (): Promise<VoteListResult> => {
  try {
    const response = await api.get(votePaths.list());
    return { votes: normalizeVoteList(response.data), unavailable: false };
  } catch (error) {
    if (isEmptyVotingDegrade(statusOf(error), bodyOf(error))) return { votes: [], unavailable: true };
    return raise(error, VOTING_COPY.loadFailed);
  }
};

export const fetchVote = async (id: number | string): Promise<Vote> => {
  try {
    const response = await api.get(votePaths.detail(id));
    const vote = normalizeVote(response.data);
    if (!vote) throw new VoteClientError(VOTING_COPY.loadFailed);
    return vote;
  } catch (error) {
    if (error instanceof VoteClientError) throw error;
    return raise(error, VOTING_COPY.loadFailed);
  }
};

export const createVote = async (payload: VoteCreatePayload): Promise<Vote> => {
  try {
    const response = await api.post(votePaths.create(), payload);
    const vote = normalizeVote(response.data);
    if (!vote) throw new VoteClientError(VOTING_COPY.postFailed);
    return vote;
  } catch (error) {
    if (error instanceof VoteClientError) throw error;
    return raise(error, VOTING_COPY.postFailed);
  }
};

export const castVote = async (id: number | string, optionId: number | string): Promise<Vote | null> => {
  try {
    const response = await api.post(votePaths.vote(id), castPayload(optionId));
    return normalizeVote(response.data);
  } catch (error) {
    return raise(error, VOTING_COPY.submitFailed);
  }
};

export const closeVoteEarly = async (id: number | string): Promise<Vote | null> => {
  try {
    const response = await api.post(votePaths.close(id), {});
    return normalizeVote(response.data);
  } catch (error) {
    return raise(error, VOTING_COPY.closeFailed);
  }
};

export const fetchVoteCircles = async (): Promise<{ circles: VoteCircle[]; unavailable: boolean }> => {
  try {
    const response = await api.get(votePaths.circles());
    return { circles: normalizeVoteCircles(response.data), unavailable: false };
  } catch (error) {
    if (isMissingVoteStatus(statusOf(error))) return { circles: [], unavailable: true };
    return raise(error, VOTING_COPY.circlesFailed);
  }
};
