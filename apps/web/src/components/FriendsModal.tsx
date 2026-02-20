import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';

interface MatchConnection {
  id: number;
  user_a: string;
  user_b: string;
}

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FriendsModal({ isOpen, onClose }: FriendsModalProps) {
  const { data: matches = [], isLoading, isError, error, refetch, isRefetching } = useQuery<
    MatchConnection[]
  >({
    queryKey: [API_ROUTES.MATCHES],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MATCHES);
      return response.json();
    },
    enabled: isOpen,
    retry: 1,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Connections
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-3">
          Your confirmed activity matches appear here.
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading connections...</div>
        ) : isError ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error instanceof Error ? error.message : 'Unable to load connections.'}
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isRefetching}>
              {isRefetching ? 'Retrying...' : 'Retry'}
            </Button>
          </div>
        ) : matches.length > 0 ? (
          <div className="space-y-2">
            {matches.map((match) => (
              <Card key={match.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium">{match.user_a}</p>
                    <p className="text-muted-foreground">{match.user_b}</p>
                  </div>
                  <Badge variant="secondary">Matched</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No connections yet</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
