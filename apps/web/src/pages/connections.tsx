import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { asArrayResponse, type PaginatedResponse } from '@/lib/paginated';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MatchUser {
  id: string | number;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
}

interface MatchItem {
  id: string | number;
  user_a?: string;
  user_b?: string;
  user_a_id?: string | number;
  user_b_id?: string | number;
  user?: MatchUser;
  matched_user?: MatchUser;
  conversation_id?: string | number;
}

function displayName(u?: MatchUser) {
  if (!u) return 'Member';
  const first = u.firstName ?? u.first_name ?? '';
  const last = u.lastName ?? u.last_name ?? '';
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name || 'Member';
}

function avatar(u?: MatchUser) {
  return u?.profileImageUrl ?? u?.profile_image_url ?? '';
}

export default function ConnectionsPage() {
  const { isAuthenticated, user: currentUser } = useAuth();

  const { data, isLoading } = useQuery<MatchItem[] | PaginatedResponse<MatchItem>>({
    queryKey: [API_ROUTES.MATCHES],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiRequest('GET', API_ROUTES.MATCHES);
      return (await res.json()) as MatchItem[] | PaginatedResponse<MatchItem>;
    },
  });

  const connections = asArrayResponse(data);
  const currentUserId = currentUser?.id != null ? String(currentUser.id) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground">
          People you&apos;ve matched with. Stay in touch even after the event ends.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No connections yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Match with people at activities and they&apos;ll appear here.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link to="/app/discovery">Browse activities</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {connections.map((m) => {
            const u = m.matched_user ?? m.user;
            const fallbackName =
              currentUserId && String(m.user_a_id) === currentUserId
                ? m.user_b
                : currentUserId && String(m.user_b_id) === currentUserId
                ? m.user_a
                : m.user_b ?? m.user_a ?? 'Member';
            const name = u ? displayName(u) : fallbackName;
            const img = u ? avatar(u) : '';
            return (
              <Card key={String(m.id)}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                    {img ? (
                      <img src={img} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground">
                        {name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">Matched</div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/matches/${m.id}/chat`}>
                      <MessageCircle className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
