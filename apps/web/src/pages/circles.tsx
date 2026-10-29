import {
  acceptCircleInvite,
  declineCircleInvite,
  fetchCircles,
  fetchInviteInbox,
} from '@/lib/circles';
import {
  CIRCLE_COPY,
  CircleClientError,
  directoryChip,
  directoryEmptyCopy,
  inviteLine,
  memberCountLabel,
} from '@shared/circles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const useDebounced = (value: string) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), 250);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
};

export default function CirclesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const debounced = useDebounced(query);
  const circles = useQuery({
    queryKey: ['circles', debounced],
    queryFn: () => fetchCircles(debounced),
    retry: false,
  });
  const inbox = useQuery({
    queryKey: ['circle-invites'],
    queryFn: fetchInviteInbox,
    retry: false,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['circles'] });
    await queryClient.invalidateQueries({ queryKey: ['circle-invites'] });
    await queryClient.invalidateQueries({ queryKey: ['prayer-circles'] });
  };
  const respond = useMutation({
    mutationFn: async (input: { id: number | string; accept: boolean }) => {
      if (input.accept) await acceptCircleInvite(input.id);
      else await declineCircleInvite(input.id);
    },
    onSuccess: refresh,
    onError: (error) =>
      setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.saveFailed),
  });
  const rows = circles.data ?? [];
  const empty =
    !circles.isLoading && !circles.isError ? directoryEmptyCopy(debounced, rows.length) : null;

  return (
    <div className="min-h-[100dvh] bg-[#f6f1ee] px-4 pb-[calc(var(--bottom-nav-offset)+1.5rem)] pt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-[#a2033f]"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-7 w-7" aria-hidden />
        </button>
        <h1 className="flex-1 font-display text-[34px] font-bold leading-tight text-[#222]">
          {CIRCLE_COPY.directoryTitle}
        </h1>
        <Link
          to="/app/circles/new"
          aria-label={CIRCLE_COPY.createTitle}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a2033f] text-white"
        >
          <Plus className="h-6 w-6" aria-hidden />
        </Link>
      </div>
      <label className="mt-4 block">
        <span className="sr-only">{CIRCLE_COPY.searchPlaceholder}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={CIRCLE_COPY.searchPlaceholder}
          className="w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3 text-base"
        />
      </label>
      {notice ? <p className="mt-3 text-sm text-red-800">{notice}</p> : null}
      <ul className="mt-4 space-y-3">
        {(inbox.data ?? []).map((invite) => (
          <li
            key={String(invite.id)}
            className="rounded-[18px] border border-[#e1dbd7] bg-white px-4 py-4"
          >
            <p className="text-base leading-6 text-[#222]">
              {inviteLine(invite.inviter?.name ?? '', invite.circleName)}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="min-h-10 rounded-full bg-[#a2033f] px-4 text-sm font-semibold text-white"
                onClick={() => respond.mutate({ id: invite.id, accept: true })}
              >
                {CIRCLE_COPY.accept}
              </button>
              <button
                type="button"
                className="min-h-10 rounded-full border border-[#e1dbd7] px-4 text-sm font-semibold"
                onClick={() => respond.mutate({ id: invite.id, accept: false })}
              >
                {CIRCLE_COPY.decline}
              </button>
            </div>
          </li>
        ))}
        {circles.isError ? (
          <li className="text-sm text-red-800">{CIRCLE_COPY.loadFailed}</li>
        ) : null}
        {empty ? (
          <li className="px-4 py-10 text-center text-base text-[#6e6a68]">{empty}</li>
        ) : null}
        {rows.map((circle) => {
          const chip = directoryChip(circle);
          return (
            <li key={String(circle.id)}>
              <Link
                to={`/app/circles/${circle.id}`}
                className="flex items-center gap-3 rounded-[18px] border border-[#e1dbd7] bg-white px-4 py-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl font-bold text-[#222]">
                    {circle.name}
                  </span>
                  <span className="mt-1 block text-sm text-[#6e6a68]">
                    {memberCountLabel(circle.memberCount)}
                  </span>
                </span>
                {chip ? (
                  <span className="rounded-full bg-[#f9e8ee] px-3 py-1 text-sm font-semibold text-[#a2033f]">
                    {chip}
                  </span>
                ) : (
                  <ChevronRight className="h-5 w-5 text-[#6e6a68]" aria-hidden />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
