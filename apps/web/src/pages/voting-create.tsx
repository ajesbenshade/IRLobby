import VoteAudienceFields from '@/components/voting/VoteAudienceFields';
import VoteRubric from '@/components/voting/VoteRubric';
import { useAuth } from '@/hooks/useAuth';
import { createVote, fetchVoteCircles } from '@/lib/voting';
import {
  DEFAULT_OPTIONS,
  OPTION_MAX,
  RUBRIC_SEEN_KEY,
  VOTING_COPY,
  VoteClientError,
  addOption,
  buildVoteCreate,
  initialAdminCircleIds,
  localInputToIso,
  removeOption,
  setOption,
  type ResultsMode,
  type VoteCreatePayload,
} from '@shared/voting';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VotingCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isChurchAdmin = Boolean(user?.isChurchAdmin);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [circleIds, setCircleIds] = useState<Array<number | string>>([]);
  const [untouched, setUntouched] = useState(true);
  const [wholeChurch, setWholeChurch] = useState(false);
  const [closesLocal, setClosesLocal] = useState('');
  const [resultsMode, setResultsMode] = useState<ResultsMode>('after_close');
  const [error, setError] = useState<string | null>(null);
  const [rubricSeen] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(RUBRIC_SEEN_KEY) === '1',
  );
  const circles = useQuery({
    queryKey: ['vote-circles'],
    queryFn: () => fetchVoteCircles(),
    retry: false,
  });
  const circleRows = circles.data?.circles ?? [];

  useEffect(() => {
    const rows = circles.data?.circles ?? [];
    setCircleIds((current) => initialAdminCircleIds(rows, untouched, current));
  }, [circles.data, untouched]);

  const circlesStatus = circles.isLoading
    ? 'loading'
    : circles.isError
    ? 'error'
    : circles.data?.unavailable
    ? 'unavailable'
    : circleRows.length === 0
    ? 'empty'
    : 'ready';
  const draft = buildVoteCreate({
    title,
    description,
    options,
    circleIds,
    wholeChurch,
    closesAt: localInputToIso(closesLocal),
    resultsMode,
    isChurchAdmin,
  });
  const post = useMutation({
    mutationFn: (payload: VoteCreatePayload) => createVote(payload),
    onSuccess: async (vote) => {
      window.localStorage.setItem(RUBRIC_SEEN_KEY, '1');
      await queryClient.invalidateQueries({ queryKey: ['votes'] });
      navigate(`/app/voting/${vote.id}`, { replace: true });
    },
    onError: (postError) => {
      setError(postError instanceof VoteClientError ? postError.message : VOTING_COPY.postFailed);
    },
  });

  const submit = () => {
    if (!draft.ok) {
      setError(draft.message);
      return;
    }
    setError(null);
    post.mutate(draft.payload);
  };

  return (
    <div className="min-h-[100dvh] bg-[#f6f1ee] px-4 pb-10">
      <header className="grid grid-cols-[auto_1fr_auto] items-center py-3">
        <button
          type="button"
          className="text-[17px] font-semibold text-[#a2033f]"
          onClick={() => navigate(-1)}
        >
          {VOTING_COPY.cancel}
        </button>
        <h1 className="text-center text-[17px] font-semibold">{VOTING_COPY.createTitle}</h1>
        <button
          type="button"
          className={`text-[17px] font-semibold ${draft.ok ? 'text-[#a2033f]' : 'text-[#c9a3b2]'}`}
          onClick={submit}
          disabled={post.isPending}
        >
          {VOTING_COPY.post}
        </button>
      </header>
      <VoteRubric startCollapsed={rubricSeen} />
      <label className="mt-4 block text-base font-semibold" htmlFor="vote-title">
        {VOTING_COPY.titleLabel}
      </label>
      <input
        id="vote-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={VOTING_COPY.titlePlaceholder}
        className="mt-2 w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3 text-base"
      />
      <p className="mt-1 text-sm text-[#6e6a68]">{VOTING_COPY.required}</p>
      <label className="mt-4 block text-base font-semibold" htmlFor="vote-description">
        {VOTING_COPY.descriptionLabel}
      </label>
      <textarea
        id="vote-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder={VOTING_COPY.descriptionPlaceholder}
        rows={4}
        className="mt-2 w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3 text-base"
      />
      <p className="mt-1 text-sm text-[#6e6a68]">{VOTING_COPY.descriptionHelper}</p>
      <h2 className="mt-4 text-base font-semibold">{VOTING_COPY.choicesLabel}</h2>
      <ul className="mt-2 space-y-2">
        {options.map((option, index) => (
          <li key={index} className="flex items-center gap-2">
            <input
              aria-label={`${VOTING_COPY.optionLabel} ${index + 1}`}
              value={option}
              onChange={(event) =>
                setOptions((current) => setOption(current, index, event.target.value))
              }
              className="min-h-12 w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 text-base"
            />
            {options.length > 2 ? (
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-[#a2033f]"
                aria-label={VOTING_COPY.removeOption}
                onClick={() => setOptions((current) => removeOption(current, index))}
              >
                {VOTING_COPY.removeOption}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {options.length < OPTION_MAX ? (
        <button
          type="button"
          className="mt-2 text-[15px] font-semibold text-[#a2033f]"
          onClick={() => setOptions((current) => addOption(current))}
        >
          + {VOTING_COPY.addOption}
        </button>
      ) : null}
      <VoteAudienceFields
        circles={circleRows}
        selectedIds={circleIds}
        onChangeSelected={(ids) => {
          setUntouched(false);
          setCircleIds(ids);
        }}
        wholeChurch={wholeChurch}
        onChangeWholeChurch={setWholeChurch}
        isChurchAdmin={isChurchAdmin}
        circlesStatus={circlesStatus}
      />
      <label className="mt-6 block text-base font-semibold" htmlFor="vote-closes">
        {VOTING_COPY.closesLabel}
      </label>
      <input
        id="vote-closes"
        type="datetime-local"
        value={closesLocal}
        onChange={(event) => setClosesLocal(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3 text-base"
      />
      <fieldset className="mt-6">
        <legend className="text-base font-semibold">{VOTING_COPY.resultsLabel}</legend>
        {(
          [
            ['after_close', VOTING_COPY.resultsAfter],
            ['live', VOTING_COPY.resultsLive],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="mt-2 flex min-h-12 items-center gap-3 text-[17px]">
            <input
              type="radio"
              name="results-mode"
              checked={resultsMode === value}
              onChange={() => setResultsMode(value)}
              className="h-5 w-5 accent-[#a2033f]"
            />
            {label}
          </label>
        ))}
      </fieldset>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
