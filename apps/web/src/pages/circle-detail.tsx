import {
  acceptCircleInvite,
  declineCircleInvite,
  fetchCircle,
  fetchInviteInbox,
  leaveCircle,
  reportCircle,
  requestToJoinCircle,
} from '@/lib/circles';
import {
  CIRCLE_COPY,
  CIRCLE_REPORT_REASONS,
  CircleClientError,
  circleDetailActions,
  inviteLine,
  leaveConfirmCopy,
  memberCountLabel,
  sameId,
  type CircleReportReason,
} from '@shared/circles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

export default function CircleDetailPage() {
  const { circleId = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(search.get('invite') === '1');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<CircleReportReason>('other');
  const [notice, setNotice] = useState<string | null>(null);
  const circleQuery = useQuery({
    queryKey: ['circle', circleId],
    queryFn: () => fetchCircle(circleId),
    enabled: circleId.length > 0,
    retry: false,
  });
  const circle = circleQuery.data;
  const inbox = useQuery({
    queryKey: ['circle-invites'],
    queryFn: fetchInviteInbox,
    enabled: circle?.membershipState === 'invited',
    retry: false,
  });
  const invite = (inbox.data ?? []).find((row) => sameId(row.circleId, circleId));
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['circle', circleId] });
    await queryClient.invalidateQueries({ queryKey: ['circles'] });
    await queryClient.invalidateQueries({ queryKey: ['circle-invites'] });
    await queryClient.invalidateQueries({ queryKey: ['prayer-circles'] });
  };
  const fail = (error: unknown) =>
    setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.saveFailed);
  const requestJoin = useMutation({
    mutationFn: () => requestToJoinCircle(circleId),
    onSuccess: refresh,
    onError: fail,
  });
  const leave = useMutation({
    mutationFn: () => leaveCircle(circleId),
    onSuccess: async () => {
      setLeaveOpen(false);
      await refresh();
    },
    onError: fail,
  });
  const accept = useMutation({
    mutationFn: () => (invite ? acceptCircleInvite(invite.id) : Promise.resolve()),
    onSuccess: refresh,
    onError: fail,
  });
  const decline = useMutation({
    mutationFn: () => (invite ? declineCircleInvite(invite.id) : Promise.resolve()),
    onSuccess: refresh,
    onError: fail,
  });
  const report = useMutation({
    mutationFn: () => reportCircle(circleId, reason),
    onSuccess: () => {
      setReportOpen(false);
      setNotice(CIRCLE_COPY.reportSent);
    },
    onError: (error) =>
      setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.reportFailed),
  });
  const actions = circle ? circleDetailActions(circle) : [];
  const dismissInvite = () => {
    setInviteOpen(false);
    if (search.get('invite') === '1') navigate(`/app/circles/${circleId}`, { replace: true });
  };

  return (
    <div className="min-h-[100dvh] bg-[#f6f1ee] px-4 pb-10">
      <button
        type="button"
        className="flex items-center py-3 font-semibold text-[#a2033f]"
        onClick={() => navigate('/app/circles')}
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
        {CIRCLE_COPY.back}
      </button>
      {circleQuery.isError ? (
        <p className="text-sm text-red-800">{CIRCLE_COPY.loadFailed}</p>
      ) : null}
      {circle ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-[32px] font-bold leading-tight text-[#222]">
              {circle.name}
            </h1>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-base text-[#6e6a68]">{memberCountLabel(circle.memberCount)}</p>
            {actions.includes('manage') ? (
              <Link
                to={`/app/circles/${circle.id}/manage`}
                className="font-semibold text-[#a2033f]"
              >
                {CIRCLE_COPY.manage}
              </Link>
            ) : null}
          </div>
          {circle.description ? (
            <p className="mt-4 text-base leading-6 text-[#222]">{circle.description}</p>
          ) : null}
          {circle.membersPreview.length > 0 ? (
            <div className="mt-4">
              <h2 className="font-semibold">{CIRCLE_COPY.members}</h2>
              <ul className="mt-2 space-y-1">
                {circle.membersPreview.map((person) => (
                  <li key={String(person.id)} className="text-base">
                    {person.name}
                    {person.isAdmin ? ' · Admin' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {notice ? <p className="mt-3 text-sm text-red-800">{notice}</p> : null}
          {invite ? (
            <p className="mt-4 text-base">{inviteLine(invite.inviter?.name ?? '', circle.name)}</p>
          ) : null}
          <div className="mt-6 space-y-3">
            {actions.includes('request') ? (
              <button
                type="button"
                className="h-[54px] w-full rounded-full bg-[#a2033f] font-semibold text-white"
                onClick={() => requestJoin.mutate()}
              >
                {CIRCLE_COPY.requestCta}
              </button>
            ) : null}
            {actions.includes('pending') ? (
              <button
                type="button"
                disabled
                className="h-[54px] w-full rounded-full bg-[#a2033f] font-semibold text-white opacity-40"
              >
                {CIRCLE_COPY.pending}
              </button>
            ) : null}
            {actions.includes('accept') && !invite && inbox.isFetched ? (
              <p className="text-base leading-6 text-[#222]">{CIRCLE_COPY.alreadyInvited}</p>
            ) : null}
            {actions.includes('accept') && invite ? (
              <>
                <button
                  type="button"
                  className="h-[54px] w-full rounded-full bg-[#a2033f] font-semibold text-white"
                  onClick={() => accept.mutate()}
                >
                  {CIRCLE_COPY.accept}
                </button>
                <button
                  type="button"
                  className="h-[54px] w-full rounded-full border border-[#e1dbd7] bg-white font-semibold"
                  onClick={() => decline.mutate()}
                >
                  {CIRCLE_COPY.decline}
                </button>
              </>
            ) : null}
            {actions.includes('leave') ? (
              <button
                type="button"
                className="h-[54px] w-full rounded-full border border-[#8a0a1f] font-semibold text-[#8a0a1f]"
                onClick={() => setLeaveOpen(true)}
              >
                {CIRCLE_COPY.leave}
              </button>
            ) : null}
            {actions.includes('invite') ? (
              <Link
                to={`/app/circles/${circle.id}/invite`}
                className="flex h-[54px] items-center justify-center rounded-full bg-[#a2033f] font-semibold text-white"
              >
                {CIRCLE_COPY.inviteCta}
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            className="mt-4 font-semibold text-[#6e6a68]"
            onClick={() => setReportOpen(true)}
          >
            {CIRCLE_COPY.report}
          </button>
        </>
      ) : null}
      {inviteOpen ? (
        <Overlay title={CIRCLE_COPY.inviteCta} onClose={dismissInvite}>
          <Link
            to={`/app/circles/${circleId}/invite`}
            className="flex h-[54px] items-center justify-center rounded-full bg-[#a2033f] font-semibold text-white"
            onClick={dismissInvite}
          >
            {CIRCLE_COPY.inviteCta}
          </Link>
          <button
            type="button"
            className="mt-3 h-[54px] w-full rounded-full border border-[#e1dbd7] font-semibold"
            onClick={dismissInvite}
          >
            {CIRCLE_COPY.skip}
          </button>
        </Overlay>
      ) : null}
      {leaveOpen ? (
        <Overlay title={CIRCLE_COPY.leave} onClose={() => setLeaveOpen(false)}>
          <p className="text-base leading-6">{leaveConfirmCopy(circle?.name ?? '')}</p>
          {leave.isError && leave.error instanceof CircleClientError ? (
            <p className="mt-3 text-sm text-red-800">{leave.error.message}</p>
          ) : null}
          <button
            type="button"
            className="mt-4 h-[54px] w-full rounded-full bg-[#8a0a1f] font-semibold text-white"
            onClick={() => leave.mutate()}
          >
            {CIRCLE_COPY.leave}
          </button>
          <button
            type="button"
            className="mt-3 h-[54px] w-full rounded-full border border-[#e1dbd7] font-semibold"
            onClick={() => setLeaveOpen(false)}
          >
            {CIRCLE_COPY.cancel}
          </button>
        </Overlay>
      ) : null}
      {reportOpen ? (
        <Overlay title={CIRCLE_COPY.report} onClose={() => setReportOpen(false)}>
          <ul>
            {CIRCLE_REPORT_REASONS.map((option) => (
              <li key={option.value}>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="radio"
                    name="circle-report-reason"
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                  />
                  {option.label}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-4 h-[54px] w-full rounded-full bg-[#a2033f] font-semibold text-white"
            onClick={() => report.mutate()}
          >
            {CIRCLE_COPY.report}
          </button>
        </Overlay>
      ) : null}
    </div>
  );
}

function Overlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md rounded-t-3xl bg-white px-5 pb-8 pt-5 md:rounded-3xl"
      >
        <h2 className="font-display text-[28px] font-bold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
