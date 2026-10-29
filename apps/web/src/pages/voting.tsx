import { useMinWidth } from '@/hooks/useMinWidth';
import { fetchVotes } from '@/lib/voting';
import VotingList from '@/pages/voting-list';
import { VOTING_COPY } from '@shared/voting';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router-dom';

export default function VotingLayout() {
  const wide = useMinWidth(1024);
  const { pathname } = useLocation();
  const creating = /\/voting\/new\/?$/.test(pathname);
  const detail = /\/voting\/(?!new\/?$)[^/]+\/?$/.test(pathname);
  const list = useQuery({
    queryKey: ['votes'],
    queryFn: () => fetchVotes(),
    retry: false,
    enabled: wide && !creating,
  });
  const hasVotes = (list.data?.votes.length ?? 0) > 0;
  const activeId = detail ? pathname.split('/').filter(Boolean).pop() : undefined;

  if (creating || (!wide && detail)) {
    return <Outlet />;
  }

  const split = wide && (detail || hasVotes);

  return (
    <div className="min-h-[100dvh] bg-[#f6f1ee] px-4 pb-[calc(var(--bottom-nav-offset)+1.5rem)] pt-4 lg:px-5 lg:pt-8">
      <div className={split ? 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-8' : undefined}>
        <VotingList activeId={activeId} />
        {split ? (
          <div className="lg:sticky lg:top-6">
            {detail ? (
              <Outlet />
            ) : (
              <p className="pt-16 text-center text-base text-[#6e6a68]">{VOTING_COPY.selectVote}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
