import { useAuth } from '@/hooks/useAuth';
import {
  approveJoinRequest,
  declineJoinRequest,
  fetchCircleMembers,
  fetchJoinRequests,
  makeCircleAdmin,
  removeCircleAdmin,
  removeCircleMember,
} from '@/lib/circles';
import { CIRCLE_COPY, CircleClientError, isLastAdmin, sameId } from '@shared/circles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

type Tab = 'requests' | 'members' | 'admins';

export default function CircleManagePage() {
  const { circleId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('requests');
  const [notice, setNotice] = useState<string | null>(null);
  const requests = useQuery({
    queryKey: ['circle-requests', circleId],
    queryFn: () => fetchJoinRequests(circleId),
    enabled: circleId.length > 0,
    retry: false,
  });
  const members = useQuery({
    queryKey: ['circle-members', circleId],
    queryFn: () => fetchCircleMembers(circleId),
    enabled: circleId.length > 0,
    retry: false,
  });
  const rows = members.data ?? [];
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['circle-requests', circleId] });
    await queryClient.invalidateQueries({ queryKey: ['circle-members', circleId] });
    await queryClient.invalidateQueries({ queryKey: ['circle', circleId] });
    await queryClient.invalidateQueries({ queryKey: ['circles'] });
    await queryClient.invalidateQueries({ queryKey: ['prayer-circles'] });
  };
  const fail = (error: unknown) =>
    setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.saveFailed);
  const guardLastAdmin = (personId: number | string) => {
    if (!isLastAdmin(rows, personId)) return false;
    setNotice(CIRCLE_COPY.lastAdmin);
    return true;
  };
  const approve = useMutation({
    mutationFn: (requestId: number | string) => approveJoinRequest(circleId, requestId),
    onSuccess: refresh,
    onError: fail,
  });
  const decline = useMutation({
    mutationFn: (requestId: number | string) => declineJoinRequest(circleId, requestId),
    onSuccess: refresh,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (userId: number | string) => removeCircleMember(circleId, userId),
    onSuccess: refresh,
    onError: fail,
  });
  const promote = useMutation({
    mutationFn: (userId: number | string) => makeCircleAdmin(circleId, userId),
    onSuccess: refresh,
    onError: fail,
  });
  const demote = useMutation({
    mutationFn: (userId: number | string) => removeCircleAdmin(circleId, userId),
    onSuccess: refresh,
    onError: fail,
  });

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
        <h1 className="text-[17px] font-semibold">{CIRCLE_COPY.manage}</h1>
      </header>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#efe8e4] p-1" role="tablist">
        {(
          [
            ['requests', CIRCLE_COPY.requests],
            ['members', CIRCLE_COPY.members],
            ['admins', CIRCLE_COPY.admins],
          ] as const
        ).map(([value, label]) => {
          const selected = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`min-h-10 rounded-xl text-sm font-semibold ${
                selected ? 'bg-white text-[#a2033f]' : 'text-[#6e6a68]'
              }`}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {notice ? <p className="mt-3 text-sm text-red-800">{notice}</p> : null}
      {tab === 'requests' ? (
        <ul className="mt-4 space-y-3">
          {requests.isError ? (
            <li className="text-sm text-red-800">{CIRCLE_COPY.loadFailed}</li>
          ) : null}
          {!requests.isLoading && (requests.data ?? []).length === 0 ? (
            <li className="py-10 text-center text-base text-[#6e6a68]">{CIRCLE_COPY.noRequests}</li>
          ) : null}
          {(requests.data ?? []).map((row) => (
            <li
              key={String(row.id)}
              className="rounded-2xl border border-[#e1dbd7] bg-white px-4 py-4"
            >
              <p className="font-semibold">{row.user.name}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="min-h-10 rounded-full bg-[#a2033f] px-4 text-sm font-semibold text-white"
                  onClick={() => approve.mutate(row.id)}
                >
                  {CIRCLE_COPY.approve}
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-full border border-[#e1dbd7] px-4 text-sm font-semibold"
                  onClick={() => decline.mutate(row.id)}
                >
                  {CIRCLE_COPY.decline}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {tab === 'members' ? (
        <ul className="mt-4 space-y-3">
          {members.isError ? (
            <li className="text-sm text-red-800">{CIRCLE_COPY.loadFailed}</li>
          ) : null}
          {rows.map((person) => {
            const self = user ? sameId(user.id, person.id) : false;
            return (
              <li
                key={String(person.id)}
                className="rounded-2xl border border-[#e1dbd7] bg-white px-4 py-4"
              >
                <p className="font-semibold">{person.name}</p>
                <button
                  type="button"
                  className="mt-3 min-h-10 rounded-full border border-[#e1dbd7] px-4 text-sm font-semibold"
                  onClick={() => {
                    setNotice(null);
                    if (guardLastAdmin(person.id)) return;
                    remove.mutate(person.id);
                  }}
                >
                  {self ? CIRCLE_COPY.leave : CIRCLE_COPY.removeMember}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {tab === 'admins' ? (
        <ul className="mt-4 space-y-3">
          {members.isError ? (
            <li className="text-sm text-red-800">{CIRCLE_COPY.loadFailed}</li>
          ) : null}
          {rows
            .filter((person) => person.isAdmin)
            .map((person) => (
              <li
                key={String(person.id)}
                className="rounded-2xl border border-[#e1dbd7] bg-white px-4 py-4"
              >
                <p className="font-semibold">{person.name}</p>
                <button
                  type="button"
                  className="mt-3 min-h-10 rounded-full border border-[#e1dbd7] px-4 text-sm font-semibold"
                  onClick={() => {
                    setNotice(null);
                    if (guardLastAdmin(person.id)) return;
                    demote.mutate(person.id);
                  }}
                >
                  {CIRCLE_COPY.removeAdmin}
                </button>
              </li>
            ))}
          {rows
            .filter((person) => !person.isAdmin)
            .map((person) => (
              <li
                key={`make-${String(person.id)}`}
                className="rounded-2xl border border-[#e1dbd7] bg-white px-4 py-4"
              >
                <p className="font-semibold">{person.name}</p>
                <button
                  type="button"
                  className="mt-3 min-h-10 rounded-full border border-[#e1dbd7] px-4 text-sm font-semibold"
                  onClick={() => {
                    setNotice(null);
                    promote.mutate(person.id);
                  }}
                >
                  {CIRCLE_COPY.makeAdmin}
                </button>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
