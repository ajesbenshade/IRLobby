import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Compass,
  MessageCircle,
  Plus,
  Sparkles,
  Star,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function parseCountResponse(json: unknown) {
  if (Array.isArray(json)) return json.length;
  if (json && typeof json === 'object') {
    const response = json as { count?: unknown; results?: unknown };
    if (typeof response.count === 'number') return response.count;
    if (Array.isArray(response.results)) return response.results.length;
  }

  throw new Error('Unexpected count response');
}

function useCount(route: string) {
  return useQuery<number>({
    queryKey: [route, 'count'],
    queryFn: async () => {
      const res = await apiRequest('GET', route);
      return parseCountResponse(await res.json());
    },
    retry: 1,
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const matches = useCount(API_ROUTES.MATCHES);
  const hosted = useCount(API_ROUTES.ACTIVITIES_HOSTED);
  const reviews = useCount(API_ROUTES.REVIEWS);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const stats = [
    {
      label: 'Matches',
      value: matches.isError ? '!' : (matches.data ?? '—'),
      icon: MessageCircle,
      to: '/app/matches',
    },
    {
      label: 'Hosted',
      value: hosted.isError ? '!' : (hosted.data ?? '—'),
      icon: Calendar,
      to: '/app/activities',
    },
    {
      label: 'Reviews',
      value: reviews.isError ? '!' : (reviews.data ?? '—'),
      icon: Star,
      to: '/app/reviews',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting}, {user?.firstName ?? 'there'} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening in your IRLobby world.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} to={s.to} className="block">
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-2xl font-semibold">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                  <Icon className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Compass className="h-4 w-4 text-primary" />
              Discover something new
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Swipe through fresh activities curated for your vibe.
            </p>
            <Button asChild size="sm">
              <Link to="/app/discovery">Open discovery</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" />
              Host an activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Plan something fun and invite the right people.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/create">Create activity</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Tune your vibe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Take the Vibe Quiz to sharpen your matches.
            </p>
            <Button asChild size="sm">
              <Link to="/app/vibe-quiz">Take the quiz</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
