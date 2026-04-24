import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTE_BUILDERS } from '@shared/schema';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Star } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

interface PublicUser {
  id: string | number;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  bio?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
  interests?: string[];
  rating?: number;
  totalRatings?: number;
  total_ratings?: number;
  eventsHosted?: number;
  events_hosted?: number;
  eventsAttended?: number;
  events_attended?: number;
}

function pick<T>(...vals: (T | undefined | null)[]) {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const route = `/api/users/${userId}/`;
  const { data, isLoading, isError } = useQuery<PublicUser>({
    queryKey: [route],
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await apiRequest('GET', route);
      return (await res.json()) as PublicUser;
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error('Missing user ID.');
      }

      await apiRequest('POST', API_ROUTE_BUILDERS.moderationBlock(userId));
    },
    onSuccess: () => {
      toast({
        title: 'User blocked',
        description: 'They will be filtered out of your feed and matches.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Unable to block user',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            We couldn't load this profile.
          </CardContent>
        </Card>
      </div>
    );
  }

  const first = pick(data.firstName, data.first_name) ?? '';
  const last = pick(data.lastName, data.last_name) ?? '';
  const name = `${first} ${last}`.trim() || 'Member';
  const avatar = pick(data.profileImageUrl, data.profile_image_url);
  const initials = (first[0] ?? 'U') + (last[0] ?? '');
  const hosted = pick(data.eventsHosted, data.events_hosted) ?? 0;
  const attended = pick(data.eventsAttended, data.events_attended) ?? 0;
  const totalRatings = pick(data.totalRatings, data.total_ratings) ?? 0;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={avatar} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          {typeof data.rating === 'number' && (
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-yellow-500" />
              {data.rating.toFixed(1)} · {totalRatings} reviews
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <div className="text-lg font-semibold">{hosted}</div>
              <div className="text-xs text-muted-foreground">Events hosted</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <div className="text-lg font-semibold">{attended}</div>
              <div className="text-xs text-muted-foreground">Events attended</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.bio && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h2 className="text-sm font-semibold">About</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{data.bio}</p>
          </CardContent>
        </Card>
      )}

      {data.interests && data.interests.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {data.interests.map((i, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {i}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link to="/app/connections">View connections</Link>
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => blockMutation.mutate()}
          disabled={blockMutation.isPending}
        >
          {blockMutation.isPending ? 'Blocking...' : 'Block user'}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button asChild variant="ghost" className="flex-1">
          <Link
            to={`/app/moderation?userId=${encodeURIComponent(String(data.id))}&name=${encodeURIComponent(name)}`}
          >
            Report user
          </Link>
        </Button>
      </div>
    </div>
  );
}
