import { fetchPrayerRequests } from '@/lib/prayer';
import { PRAYER_COPY, prayerListMeta, type PrayerScope } from '@shared/prayer';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function PrayerRequestsPage() {
  const [scope, setScope] = useState<Extract<PrayerScope, 'active' | 'mine'>>('active');
  const list = useQuery({
    queryKey: ['prayer-requests', scope],
    queryFn: () => fetchPrayerRequests(scope),
    retry: false,
  });
  const items = list.data?.items ?? [];
  const unavailable = list.data?.unavailable === true;
  const emptyTitle = scope === 'mine' ? PRAYER_COPY.emptyMine : PRAYER_COPY.emptyActive;
  const emptyBody = unavailable
    ? PRAYER_COPY.unavailable
    : scope === 'mine'
    ? PRAYER_COPY.emptyMineBody
    : PRAYER_COPY.emptyActiveBody;

  return (
    <div className="min-h-[100dvh] bg-[#f6f1ee] px-4 pb-[calc(var(--bottom-nav-offset)+1.5rem)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[34px] font-bold leading-tight text-[#222]">
          {PRAYER_COPY.listTitle}
        </h1>
        <Link
          to="/app/prayer/new"
          aria-label={PRAYER_COPY.newRequest}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a2033f] text-white"
        >
          <Plus className="h-6 w-6" aria-hidden />
        </Link>
      </div>
      <Link
        to="/app/circles"
        className="mt-4 flex min-h-[52px] items-center justify-between rounded-2xl border border-[#e1dbd7] bg-white px-4"
      >
        <span className="text-[17px] font-semibold">Circles</span>
        <ChevronRight className="h-5 w-5 text-[#6e6a68]" aria-hidden />
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-[#efe8e4] p-1" role="tablist">
        {(['active', 'mine'] as const).map((value) => {
          const selected = scope === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`min-h-10 rounded-xl text-[15px] font-semibold ${
                selected ? 'bg-white text-[#a2033f]' : 'text-[#6e6a68]'
              }`}
              onClick={() => setScope(value)}
            >
              {value === 'active' ? PRAYER_COPY.active : PRAYER_COPY.mine}
            </button>
          );
        })}
      </div>
      {list.isError ? <p className="mt-4 text-sm text-red-800">{PRAYER_COPY.loadFailed}</p> : null}
      {!list.isLoading && items.length === 0 ? (
        <div className="mt-16 px-4 text-center">
          <p className="font-display text-2xl text-[#222]">{emptyTitle}</p>
          <p className="mt-2 text-base text-[#6e6a68]">{emptyBody}</p>
        </div>
      ) : null}
      <ul className="mt-4 space-y-3">
        {items.map((prayer) => {
          const meta = prayerListMeta(prayer);
          return (
            <li key={String(prayer.id)}>
              <Link
                to={`/app/prayer/${prayer.id}`}
                className="flex items-center gap-2 rounded-[18px] border border-[#e1dbd7] bg-white px-4 py-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl font-bold leading-snug text-[#222]">
                    {prayer.title}
                  </span>
                  <span className="mt-1 block text-sm">
                    <span className="font-semibold text-[#a2033f]">{meta.count}</span>
                    <span className="text-[#6e6a68]">{meta.rest}</span>
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#6e6a68]" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
