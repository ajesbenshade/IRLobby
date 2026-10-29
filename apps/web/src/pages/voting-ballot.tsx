import { useMinWidth } from '@/hooks/useMinWidth';
import { castVote, closeVote, fetchVote } from '@/lib/voting';
import {
  VOTING_COPY,
  VoteClientError,
  canCastVote,
  detailChips,
  isVoteOpen,
  optionShare,
  talliesVisible,
  visibleTotal,
  voteRowSubline,
} from '@shared/voting';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function VotingBallotPage() {
  const { voteId = '' } = useParams();
  const navigate = useNavigate();
  const wide = useMinWidth(1024);
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const voteQuery = useQuery({
    queryKey: ['vote', voteId],
    queryFn: () => fetchVote(voteId),
    enabled: Boolean(voteId),
    retry: false,
  });
  const vote = voteQuery.data;
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['vote', voteId] });
    await queryClient.invalidateQueries({ queryKey: ['votes'] });
  };
  const cast = useMutation({
    mutationFn: (optionId: string) => castVote(voteId, optionId),
    onSuccess: refresh,
    onError: (error) =>
      setNotice(error instanceof VoteClientError ? error.message : VOTING_COPY.submitFailed),
  });
  const close = useMutation({
    mutationFn: () => closeVote(voteId),
    onSuccess: async () => {
      setConfirmClose(false);
      await refresh();
    },
    onError: (error) =>
      setNotice(error instanceof VoteClientError ? error.message : VOTING_COPY.closeFailed),
  });

  const open = vote ? isVoteOpen(vote) : false;
  const showTallies = vote ? talliesVisible(vote) : false;
  const canCast = vote ? canCastVote(vote) : false;
  const locked = Boolean(vote) && !canCast;
  const selected = vote?.hasVoted && vote.myOptionId != null ? String(vote.myOptionId) : picked;
  const total = vote ? visibleTotal(vote) : null;

  return (
    <div className={wide ? '' : 'min-h-[100dvh] bg-[#f6f1ee] px-4 pb-10'}>
      {wide ? null : (
        <header className="flex items-center py-2">
          <button
            type="button"
            className="flex items-center font-semibold text-[#a2033f]"
            onClick={() => navigate('/app/voting')}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
            {VOTING_COPY.back}
          </button>
        </header>
      )}
      {voteQuery.isError ? <p className="text-sm text-red-800">{VOTING_COPY.loadFailed}</p> : null}
      {vote ? (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {detailChips(vote).map((chip) => (
              <span
                key={chip}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  chip === VOTING_COPY.chip
                    ? 'bg-[#f9e8ee] text-[#a2033f]'
                    : 'bg-[#f3eeeb] text-[#222]'
                }`}
              >
                {chip}
              </span>
            ))}
          </div>
          <h1 className="mt-4 font-display text-[34px] font-bold leading-tight text-[#222]">
            {vote.title}
          </h1>
          <p className="mt-2 text-[15px] text-[#6e6a68]">{voteRowSubline(vote)}</p>
          {vote.description.trim() ? (
            <p className="mt-4 text-[17px] leading-7 text-[#222]">{vote.description.trim()}</p>
          ) : null}
          {!open ? (
            <p className="mt-4 font-semibold text-[#222]">{VOTING_COPY.closedBanner}</p>
          ) : null}
          {vote.hasVoted ? (
            <p className="mt-4 font-semibold text-[#a2033f]">{VOTING_COPY.submitted}</p>
          ) : null}
          <fieldset className="mt-4 space-y-2" disabled={locked || cast.isPending}>
            <legend className="sr-only">{vote.title}</legend>
            {vote.options.map((option) => {
              const share = showTallies ? optionShare(option.count, total) : null;
              const chosen = selected != null && String(option.id) === selected;
              return (
                <label
                  key={String(option.id)}
                  className={`block rounded-2xl border bg-white px-4 py-3 ${
                    chosen ? 'border-[#a2033f] bg-[#f9e8ee]' : 'border-[#e1dbd7]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`vote-${vote.id}`}
                      value={String(option.id)}
                      checked={chosen}
                      onChange={() => {
                        setPicked(String(option.id));
                        setNotice(null);
                      }}
                      className="h-5 w-5 accent-[#a2033f]"
                    />
                    <span className="min-w-0 flex-1 text-[17px] text-[#222]">{option.label}</span>
                    {showTallies && option.count != null ? (
                      <span className="text-sm font-semibold text-[#6e6a68]">
                        {option.count}
                        {share != null ? ` · ${share}%` : ''}
                      </span>
                    ) : null}
                  </span>
                  {showTallies && share != null ? (
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#efe8e4]">
                      <span className="block h-full bg-[#a2033f]" style={{ width: `${share}%` }} />
                    </span>
                  ) : null}
                </label>
              );
            })}
          </fieldset>
          {open && !showTallies ? (
            <p className="mt-3 text-sm text-[#6e6a68]">{VOTING_COPY.resultsHidden}</p>
          ) : null}
          {canCast ? (
            <>
              <button
                type="button"
                className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-[#a2033f] text-base font-semibold text-white disabled:opacity-60"
                disabled={selected == null || cast.isPending}
                onClick={() => {
                  if (selected == null) return;
                  setNotice(null);
                  cast.mutate(selected);
                }}
              >
                {VOTING_COPY.submit}
              </button>
              <p className="mt-3 text-center text-sm leading-5 text-[#6e6a68]">
                {VOTING_COPY.submitOnce}
              </p>
            </>
          ) : null}
          {open && vote.canClose ? (
            <div className="mt-6 text-center">
              {confirmClose ? (
                <>
                  <p className="text-sm text-[#6e6a68]">{VOTING_COPY.closeConfirm}</p>
                  <button
                    type="button"
                    className="mt-2 font-semibold text-[#a2033f]"
                    onClick={() => close.mutate()}
                    disabled={close.isPending}
                  >
                    {VOTING_COPY.closeNow}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="font-semibold text-[#a2033f]"
                  onClick={() => setConfirmClose(true)}
                >
                  {VOTING_COPY.closeVote}
                </button>
              )}
            </div>
          ) : null}
          {notice ? <p className="mt-3 text-center text-sm text-red-800">{notice}</p> : null}
        </>
      ) : null}
    </div>
  );
}
