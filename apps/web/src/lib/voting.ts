import { apiRequest } from '@/lib/queryClient';
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

export type VoteListResult = {
  votes: Vote[];
  unavailable: boolean;
};

const statusOf = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

const bodyOf = (error: unknown): unknown => {
  if (typeof error === 'object' && error && 'body' in error) {
    return (error as { body?: unknown }).body;
  }
  return undefined;
};

const messageOf = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    const stripped = error.message.replace(/^\d+:\s*/, '').trim();
    if (stripped) return stripped;
  }
  return fallback;
};

const raise = (error: unknown, fallback: string): never => {
  throw new VoteClientError(messageOf(error, fallback), statusOf(error));
};

const readBody = async (response: Response) => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
};

const request = async (method: 'GET' | 'POST', url: string, body?: unknown) => {
  const response = await apiRequest(method, url, body);
  return readBody(response);
};

/** Same bearer client and contract as Directory, Connections, and Circles. See `@shared/voting`. */
export async function fetchVotes(): Promise<VoteListResult> {
  try {
    const data = await request('GET', votePaths.list());
    return { votes: normalizeVoteList(data), unavailable: false };
  } catch (error) {
    if (isEmptyVotingDegrade(statusOf(error), bodyOf(error)))
      return { votes: [], unavailable: true };
    return raise(error, VOTING_COPY.loadFailed);
  }
}

export async function fetchVote(id: number | string): Promise<Vote> {
  try {
    const vote = normalizeVote(await request('GET', votePaths.detail(id)));
    if (!vote) throw new VoteClientError(VOTING_COPY.loadFailed);
    return vote;
  } catch (error) {
    if (error instanceof VoteClientError) throw error;
    return raise(error, VOTING_COPY.loadFailed);
  }
}

export async function createVote(payload: VoteCreatePayload): Promise<Vote> {
  try {
    const vote = normalizeVote(await request('POST', votePaths.create(), payload));
    if (!vote) throw new VoteClientError(VOTING_COPY.postFailed);
    return vote;
  } catch (error) {
    if (error instanceof VoteClientError) throw error;
    return raise(error, VOTING_COPY.postFailed);
  }
}

export async function castVote(
  id: number | string,
  optionId: number | string,
): Promise<Vote | null> {
  try {
    return normalizeVote(await request('POST', votePaths.vote(id), castPayload(optionId)));
  } catch (error) {
    return raise(error, VOTING_COPY.submitFailed);
  }
}

export async function closeVote(id: number | string): Promise<Vote | null> {
  try {
    return normalizeVote(await request('POST', votePaths.close(id), {}));
  } catch (error) {
    return raise(error, VOTING_COPY.closeFailed);
  }
}

export async function fetchVoteCircles(): Promise<{ circles: VoteCircle[]; unavailable: boolean }> {
  try {
    return {
      circles: normalizeVoteCircles(await request('GET', votePaths.circles())),
      unavailable: false,
    };
  } catch (error) {
    if (isMissingVoteStatus(statusOf(error))) return { circles: [], unavailable: true };
    return raise(error, VOTING_COPY.circlesFailed);
  }
}
