import PrayerVisibilityFields from '@/components/prayer/PrayerVisibilityFields';
import { createPrayerRequest, fetchPrayerCircles } from '@/lib/prayer';
import {
  PRAYER_COPY,
  PrayerClientError,
  buildPrayerCreate,
  initialCircleIds,
  type PrayerCreatePayload,
} from '@shared/prayer';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrayerCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [circleIds, setCircleIds] = useState<Array<number | string>>([]);
  const [untouched, setUntouched] = useState(true);
  const [wholeChurch, setWholeChurch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const circles = useQuery({
    queryKey: ['prayer-circles'],
    queryFn: () => fetchPrayerCircles(),
    retry: false,
  });
  const circleRows = circles.data?.circles ?? [];

  useEffect(() => {
    const rows = circles.data?.circles ?? [];
    setCircleIds((current) => initialCircleIds(rows, untouched, current));
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
  const draft = buildPrayerCreate({ title, details, circleIds, wholeChurch });
  const post = useMutation({
    mutationFn: (payload: PrayerCreatePayload) => createPrayerRequest(payload),
    onSuccess: async (prayer) => {
      await queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      navigate(`/app/prayer/${prayer.id}`, { replace: true });
    },
    onError: (postError) => {
      setError(postError instanceof PrayerClientError ? postError.message : PRAYER_COPY.postFailed);
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
          {PRAYER_COPY.cancel}
        </button>
        <h1 className="text-center text-[17px] font-semibold">{PRAYER_COPY.createTitle}</h1>
        <button
          type="button"
          className={`text-[17px] font-semibold ${draft.ok ? 'text-[#a2033f]' : 'text-[#c9a3b2]'}`}
          onClick={submit}
          disabled={post.isPending}
        >
          {PRAYER_COPY.post}
        </button>
      </header>
      <label className="mt-4 block text-base font-semibold" htmlFor="prayer-title">
        {PRAYER_COPY.titleLabel}
      </label>
      <input
        id="prayer-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={PRAYER_COPY.titlePlaceholder}
        className="mt-2 w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3 text-base"
      />
      <p className="mt-1 text-sm text-[#6e6a68]">{PRAYER_COPY.required}</p>
      <label className="mt-4 block text-base font-semibold" htmlFor="prayer-details">
        {PRAYER_COPY.detailsLabel}
      </label>
      <textarea
        id="prayer-details"
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        placeholder={PRAYER_COPY.detailsPlaceholder}
        rows={4}
        className="mt-2 w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3 text-base"
      />
      <p className="mt-1 text-sm text-[#6e6a68]">{PRAYER_COPY.detailsHelper}</p>
      <PrayerVisibilityFields
        circles={circleRows}
        selectedIds={circleIds}
        onChangeSelected={(ids) => {
          setUntouched(false);
          setCircleIds(ids);
        }}
        wholeChurch={wholeChurch}
        onChangeWholeChurch={setWholeChurch}
        circlesStatus={circlesStatus}
        onBrowseCircles={() => navigate('/app/circles')}
      />
      <p className="mt-6 text-[15px] leading-6 text-[#6e6a68]">{PRAYER_COPY.noDatePlace}</p>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
