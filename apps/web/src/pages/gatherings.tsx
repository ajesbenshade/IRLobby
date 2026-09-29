import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { apiRequest } from '@/lib/queryClient';
import {
  coverPhotoUrl,
  isUpcomingGathering,
  whosGoingSummary,
  type GatheringLike,
} from '@/lib/foyer';

type Row = GatheringLike & { id: number | string; title: string; time?: string };

const formatWhen = (value?: string | null) => {
  if (!value) return 'Date pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

async function loadList(path: string): Promise<Row[]> {
  const response = await apiRequest('GET', path);
  const data = (await response.json()) as Row[] | { results?: Row[] };
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function GatheringsPage() {
  const [segment, setSegment] = useState<'upcoming' | 'past'>('upcoming');
  const hosted = useQuery({
    queryKey: ['foyer-hosted'],
    queryFn: () => loadList('/api/activities/hosted/'),
  });
  const going = useQuery({
    queryKey: ['foyer-going'],
    queryFn: () => loadList('/api/activities/going/'),
  });
  const filter = (rows: Row[]) =>
    rows.filter((row) =>
      segment === 'upcoming' ? isUpcomingGathering(row.time) : !isUpcomingGathering(row.time),
    );

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#f6f1ee] px-5 pb-28 pt-8">
      <h1 className="font-display text-[28px] text-[#222222]">Your gatherings</h1>
      <div className="mt-4 flex rounded-xl bg-white p-1">
        {(['upcoming', 'past'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`h-10 flex-1 rounded-lg text-sm ${
              segment === value ? 'font-semibold text-[#a2033f]' : 'text-[#6e6a68]'
            }`}
            onClick={() => setSegment(value)}
          >
            {value === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>
      <Section
        label="HOSTING"
        rows={filter(hosted.data ?? [])}
        summary={(row) => `${row.going_count ?? row.participant_count ?? 0} going`}
      />
      <Section
        label="GOING"
        rows={filter(going.data ?? [])}
        summary={(row) => whosGoingSummary(row.my_rsvp?.people_count)}
      />
    </div>
  );
}

function Section({
  label,
  rows,
  summary,
}: {
  label: string;
  rows: Row[];
  summary: (row: Row) => string;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-xs font-bold tracking-wide text-[#6e6a68]">{label}</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-[#6e6a68]">Nothing here yet.</p> : null}
      <div className="mt-2 space-y-3">
        {rows.map((row) => {
          const photo = coverPhotoUrl(row);
          return (
            <div
              key={String(row.id)}
              className="flex items-center gap-3 rounded-[16px] bg-white p-3"
            >
              {photo ? (
                <img src={photo} alt="" className="h-14 w-14 rounded-xl object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-[#e7d7cc]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[16px]">{row.title}</p>
                <p className="text-sm text-[#6e6a68]">{formatWhen(row.time)}</p>
                <p className="text-sm text-[#6e6a68]">{summary(row)}</p>
              </div>
              <Link
                to={`/app/activity/${row.id}`}
                className="rounded-full bg-[#f9e8ee] px-3 py-2 text-sm font-semibold text-[#a2033f]"
              >
                Chat
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
