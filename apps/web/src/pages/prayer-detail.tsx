import { fetchPrayerRequest, prayForRequest, reportPrayerRequest, stopPraying } from '@/lib/prayer';
import {
  PRAYER_COPY,
  PrayerClientError,
  chipLabels,
  personInitials,
  postedByLine,
  postedDayLabel,
  prayingLabel,
  visibleToLabel,
} from '@shared/prayer';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, MoreHorizontal, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export default function PrayerDetailPage() {
  const { prayerId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const prayerQuery = useQuery({
    queryKey: ['prayer-request', prayerId],
    queryFn: () => fetchPrayerRequest(prayerId),
    enabled: Boolean(prayerId),
    retry: false,
  });
  const prayer = prayerQuery.data;
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['prayer-request', prayerId] });
    await queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
  };
  const pray = useMutation({
    mutationFn: () => prayForRequest(prayerId),
    onSuccess: refresh,
    onError: (error) =>
      setNotice(error instanceof PrayerClientError ? error.message : PRAYER_COPY.prayFailed),
  });
  const stop = useMutation({
    mutationFn: () => stopPraying(prayerId),
    onSuccess: refresh,
    onError: (error) =>
      setNotice(error instanceof PrayerClientError ? error.message : PRAYER_COPY.stopFailed),
  });

  return (
    <div className="min-h-[100dvh] bg-[#f6f1ee] px-4 pb-10">
      <header className="flex items-center justify-between py-2">
        <button
          type="button"
          className="flex items-center font-semibold text-[#a2033f]"
          onClick={() => navigate('/app/prayer')}
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
          {PRAYER_COPY.backToPrayer}
        </button>
        <button type="button" aria-label="More" onClick={() => setMenu((open) => !open)}>
          <MoreHorizontal className="h-6 w-6" />
        </button>
      </header>
      {menu ? (
        <div className="mb-3 rounded-2xl border bg-white p-2">
          <button
            type="button"
            className="w-full px-3 py-3 text-left"
            onClick={() => {
              setMenu(false);
              void reportPrayerRequest(prayerId)
                .then((result) => {
                  setNotice(
                    result === 'sent' ? PRAYER_COPY.reportSent : PRAYER_COPY.reportUnavailable,
                  );
                })
                .catch(() => setNotice(PRAYER_COPY.reportUnavailable));
            }}
          >
            {PRAYER_COPY.report}
          </button>
        </div>
      ) : null}
      {prayerQuery.isError ? (
        <p className="text-sm text-red-800">{PRAYER_COPY.loadFailed}</p>
      ) : null}
      {prayer ? (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#f9e8ee] px-3 py-1 text-sm font-semibold text-[#a2033f]">
              {PRAYER_COPY.prayerChip}
            </span>
            {chipLabels(prayer).map((chip) => (
              <span key={chip} className="rounded-full bg-[#f3eeeb] px-3 py-1 text-sm">
                {chip}
              </span>
            ))}
          </div>
          <h1 className="mt-4 font-display text-[34px] font-bold leading-tight text-[#222]">
            {prayer.title}
          </h1>
          <p className="mt-3 flex items-center gap-2 text-[15px] text-[#6e6a68]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3c1d0] text-[11px] font-semibold text-[#a2033f]">
              {personInitials(prayer.author.name)}
            </span>
            {postedByLine(prayer.author.name, postedDayLabel(prayer.createdAt))}
          </p>
          {prayer.details.trim() ? (
            <p className="mt-4 text-[17px] leading-7 text-[#222]">{prayer.details.trim()}</p>
          ) : null}
          <p className="mt-4 flex items-center gap-2 rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3">
            <UserRound className="h-5 w-5 text-[#6e6a68]" aria-hidden />
            {visibleToLabel(prayer)}
          </p>
          <p className="mt-4 font-semibold text-[#a2033f]">{prayingLabel(prayer.prayingCount)}</p>
          {prayer.viewerIsPraying ? (
            <>
              <Link
                to={`/app/prayer/${prayer.id}/chat`}
                className="mt-4 flex h-14 items-center justify-center rounded-full bg-[#a2033f] text-base font-semibold text-white"
              >
                {PRAYER_COPY.openChat}
              </Link>
              <button
                type="button"
                className="mt-2 w-full py-3 text-center text-base font-semibold text-[#a2033f]"
                onClick={() => stop.mutate()}
                disabled={stop.isPending}
              >
                {PRAYER_COPY.stopPraying}
              </button>
              <p className="mt-2 text-center text-sm leading-5 text-[#6e6a68]">
                {PRAYER_COPY.prayingHelp}
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-[#a2033f] text-base font-semibold text-white disabled:opacity-60"
                onClick={() => pray.mutate()}
                disabled={pray.isPending}
              >
                {PRAYER_COPY.imPraying}
              </button>
              <p className="mt-3 text-center text-sm leading-5 text-[#6e6a68]">
                {PRAYER_COPY.joinHelp}
              </p>
            </>
          )}
          {notice ? <p className="mt-3 text-center text-sm text-[#6e6a68]">{notice}</p> : null}
        </>
      ) : null}
    </div>
  );
}
