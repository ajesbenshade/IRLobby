import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { fetchVoteCircles, fetchVotes } from '@/lib/voting';
import {
  VOTING_COPY,
  audienceChip,
  canCreateVote,
  sectionVotes,
  voteRowSubline,
  type Vote,
} from '@shared/voting';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VotingList({ activeId }: { activeId?: string }) {
  const { user } = useAuth();
  const list = useQuery({
    queryKey: ['votes'],
    queryFn: () => fetchVotes(),
    retry: false,
  });
  const circles = useQuery({
    queryKey: ['vote-circles'],
    queryFn: () => fetchVoteCircles(),
    retry: false,
  });
  const votes = list.data?.votes ?? [];
  const sections = sectionVotes(votes);
  const canCreate = canCreateVote({
    isChurchAdmin: Boolean(user?.isChurchAdmin),
    circles: circles.data?.circles ?? [],
  });
  const empty = !list.isLoading && !list.isError && votes.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[34px] font-bold leading-tight text-[#222]">
          {VOTING_COPY.title}
        </h1>
        <Link
          to="/app/voting/new"
          aria-label={VOTING_COPY.newVote}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a2033f] text-white"
        >
          <Plus className="h-6 w-6" aria-hidden />
        </Link>
      </div>
      {list.isLoading ? <VoteSkeletons /> : null}
      {list.isError ? (
        <div className="mt-8 text-center">
          <p className="text-base text-[#222]">{VOTING_COPY.loadFailed}</p>
          <button
            type="button"
            className="mt-3 text-base font-semibold text-[#a2033f]"
            onClick={() => void list.refetch()}
          >
            {VOTING_COPY.tryAgain}
          </button>
        </div>
      ) : null}
      {empty ? (
        <div className="mt-16 px-4 text-center">
          <p className="font-display text-2xl text-[#222]">{VOTING_COPY.emptyTitle}</p>
          <p className="mt-2 text-base text-[#6e6a68]">{VOTING_COPY.emptyBody}</p>
          {canCreate ? (
            <Link
              to="/app/voting/new"
              className="mt-6 inline-flex h-14 items-center justify-center rounded-full bg-[#a2033f] px-8 text-base font-semibold text-white"
            >
              {VOTING_COPY.newVote}
            </Link>
          ) : null}
        </div>
      ) : null}
      {!list.isLoading && !list.isError && votes.length > 0 ? (
        <div className="mt-6 space-y-6">
          <VoteSection label={VOTING_COPY.openSection} votes={sections.open} activeId={activeId} />
          <VoteSection
            label={VOTING_COPY.closedSection}
            votes={sections.closed}
            activeId={activeId}
          />
        </div>
      ) : null}
    </div>
  );
}

function VoteSection({
  label,
  votes,
  activeId,
}: {
  label: string;
  votes: Vote[];
  activeId?: string;
}) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wide text-[#6e6a68]">{label}</h2>
      {votes.length === 0 ? (
        <p className="mt-2 text-sm text-[#6e6a68]">{VOTING_COPY.sectionEmpty}</p>
      ) : null}
      <ul className="mt-2 space-y-3">
        {votes.map((vote) => {
          const subline = voteRowSubline(vote);
          const chip = audienceChip(vote);
          const selected = activeId != null && String(activeId) === String(vote.id);
          return (
            <li key={String(vote.id)}>
              <Link
                to={`/app/voting/${vote.id}`}
                aria-current={selected ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-[18px] border bg-white px-4 py-4 ${
                  selected ? 'border-[#a2033f]' : 'border-[#e1dbd7]'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="block font-display text-xl font-bold leading-snug text-[#222]">
                      {vote.title}
                    </span>
                    {vote.hasVoted ? (
                      <span className="shrink-0 rounded-full bg-[#f9e8ee] px-2 py-0.5 text-xs font-semibold text-[#a2033f]">
                        {VOTING_COPY.voted}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#6e6a68]">
                    <span>{subline}</span>
                    <span className="rounded-full bg-[#f3eeeb] px-2 py-0.5 text-xs font-semibold text-[#222]">
                      {chip}
                    </span>
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#6e6a68]" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function VoteSkeletons() {
  return (
    <div className="mt-6 space-y-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-[76px] w-full rounded-[18px] bg-[#efe8e4]" />
      ))}
    </div>
  );
}
