import { searchCirclePeople, sendCircleInvites } from '@/lib/circles';
import { CIRCLE_COPY, CIRCLE_INVITE_BATCH_MAX, CircleClientError, sameId } from '@shared/circles';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const useDebounced = (value: string) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), 250);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
};

export default function CircleInvitePage() {
  const { circleId = '' } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Array<number | string>>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const debounced = useDebounced(query);
  const people = useQuery({
    queryKey: ['circle-people', circleId, debounced],
    queryFn: () => searchCirclePeople(circleId, debounced),
    enabled: circleId.length > 0,
    retry: false,
  });
  const toggle = (id: number | string) => {
    setSelected((current) => {
      if (current.some((item) => sameId(item, id)))
        return current.filter((item) => !sameId(item, id));
      if (current.length >= CIRCLE_INVITE_BATCH_MAX) return current;
      return [...current, id];
    });
  };
  const send = useMutation({
    mutationFn: () => sendCircleInvites(circleId, selected),
    onSuccess: (result) => {
      const sent = new Set(result.invites.map((invite) => String(invite.invitee.id)));
      setSelected((current) => current.filter((id) => !sent.has(String(id))));
      if (result.errors.length > 0) {
        setNotice(result.errors.map((error) => error.detail).join(' '));
        return;
      }
      navigate(-1);
    },
    onError: (error) =>
      setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.sendFailed),
  });
  const rows = people.data ?? [];

  return (
    <div className="min-h-[100dvh] bg-[#f6f1ee] px-4 pb-10">
      <header className="flex items-center gap-1 py-3">
        <button
          type="button"
          aria-label="Back"
          className="text-[#a2033f]"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-7 w-7" aria-hidden />
        </button>
        <h1 className="text-[17px] font-semibold">{CIRCLE_COPY.inviteCta}</h1>
      </header>
      <label className="block">
        <span className="sr-only">{CIRCLE_COPY.peopleSearch}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={CIRCLE_COPY.peopleSearch}
          className="w-full rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3 text-base"
        />
      </label>
      {people.isError ? (
        <p className="mt-3 text-sm text-red-800">{CIRCLE_COPY.loadFailed}</p>
      ) : null}
      {!people.isLoading && rows.length === 0 ? (
        <p className="mt-8 text-center text-base text-[#6e6a68]">{CIRCLE_COPY.noPeople}</p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {rows.map((person) => {
          const invited = person.inviteState === 'invited';
          const checked = selected.some((id) => sameId(id, person.id));
          return (
            <li key={String(person.id)}>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#e1dbd7] bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={invited}
                  onChange={() => toggle(person.id)}
                />
                <span className="flex-1 text-[17px]">{person.name}</span>
                {invited ? (
                  <span className="text-sm font-semibold text-[#6e6a68]">
                    {CIRCLE_COPY.invited}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
      {notice ? <p className="mt-3 text-sm text-red-800">{notice}</p> : null}
      <button
        type="button"
        disabled={selected.length === 0 || send.isPending}
        className="mt-6 h-[54px] w-full rounded-full bg-[#a2033f] font-semibold text-white disabled:opacity-40"
        onClick={() => {
          setNotice(null);
          send.mutate();
        }}
      >
        {CIRCLE_COPY.sendInvites}
      </button>
    </div>
  );
}
