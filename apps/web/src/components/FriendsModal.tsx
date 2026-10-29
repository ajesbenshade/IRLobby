import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchConnections } from '@/lib/connections';
import {
  CONNECTIONS_COPY,
  connectionContextLine,
  connectionDestination,
  connectionInitials,
  connectionRowKey,
  type ConnectionPeer,
} from '@shared/connections';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const sectionCopy = {
  gathering: {
    header: CONNECTIONS_COPY.gatheringHeader,
    emptyTitle: CONNECTIONS_COPY.gatheringEmptyTitle,
    emptyBody: CONNECTIONS_COPY.gatheringEmptyBody,
  },
  praying: {
    header: CONNECTIONS_COPY.prayingHeader,
    emptyTitle: CONNECTIONS_COPY.prayingEmptyTitle,
    emptyBody: CONNECTIONS_COPY.prayingEmptyBody,
  },
} as const;

export default function FriendsModal({ isOpen, onClose }: FriendsModalProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['connections'],
    queryFn: fetchConnections,
    enabled: isOpen,
    retry: 1,
  });

  const openPeer = (peer: ConnectionPeer) => {
    const destination = connectionDestination(peer);
    if (!destination) return;
    onClose();
    if (destination.kind === 'profile') {
      navigate(`/app/user/${destination.userId}`);
      return;
    }
    navigate(`/app/prayer/${destination.prayerId}`);
  };

  const showSections = !isLoading && !isError;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden border-[#e1dbd7] bg-[#f6f1ee] p-0">
        <div className="px-6 pb-2 pr-12 pt-6">
          <DialogHeader>
            <DialogTitle className="text-[#222]">{CONNECTIONS_COPY.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6e6a68]">{CONNECTIONS_COPY.intro}</p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-[#6e6a68]">{CONNECTIONS_COPY.loading}</p>
          ) : null}

          {isError ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-[#8a0a1f]">{CONNECTIONS_COPY.error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
                disabled={isRefetching}
              >
                {CONNECTIONS_COPY.retry}
              </Button>
            </div>
          ) : null}

          {showSections ? (
            <>
              <ConnectionSection kind="gathering" peers={data?.gathering ?? []} onOpen={openPeer} />
              <ConnectionSection kind="praying" peers={data?.praying ?? []} onOpen={openPeer} />
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionSection({
  kind,
  peers,
  onOpen,
}: {
  kind: keyof typeof sectionCopy;
  peers: ConnectionPeer[];
  onOpen: (peer: ConnectionPeer) => void;
}) {
  const copy = sectionCopy[kind];
  return (
    <section className="pb-2">
      <h2 className="sticky top-0 z-10 bg-[#f6f1ee] py-3 text-[15px] font-semibold text-[#222]">
        {copy.header(peers.length)}
      </h2>
      {peers.length === 0 ? (
        <div className="px-2 py-5 text-center">
          <p className="font-semibold text-[#222]">{copy.emptyTitle}</p>
          <p className="mt-1 text-sm leading-5 text-[#6e6a68]">{copy.emptyBody}</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-white">
          {peers.map((peer, index) => {
            const line = connectionContextLine(peer);
            const destination = connectionDestination(peer);
            const label = line ? `${peer.displayName}, ${line}` : peer.displayName;
            const row = (
              <>
                <Avatar className="h-10 w-10">
                  {peer.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="bg-[#222] text-sm text-white">
                    {connectionInitials(peer.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold text-[#222]">
                    {peer.displayName}
                  </span>
                  {line ? (
                    <span className="block truncate text-sm text-[#6e6a68]">{line}</span>
                  ) : null}
                </span>
                {destination ? (
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#6e6a68]" aria-hidden />
                ) : null}
              </>
            );
            return (
              <li
                key={connectionRowKey(peer, index)}
                className={index < peers.length - 1 ? 'border-b border-[#e1dbd7]' : undefined}
              >
                {destination ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3"
                    aria-label={label}
                    onClick={() => onOpen(peer)}
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
