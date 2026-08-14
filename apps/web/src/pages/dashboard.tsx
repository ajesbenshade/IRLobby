import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Compass, MessageCircle, Plus, Sparkles, Star } from 'lucide-react';
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
      value: matches.isError ? '!' : matches.data ?? '—',
      icon: MessageCircle,
      to: '/app/matches',
    },
    {
      label: 'Hosted',
      value: hosted.isError ? '!' : hosted.data ?? '—',
      icon: Calendar,
      to: '/app/activities',
    },
    {
      label: 'Reviews',
      value: reviews.isError ? '!' : reviews.data ?? '—',
      icon: Star,
      to: '/app/reviews',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {greeting}, {user?.firstName ?? 'there'}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          What&apos;s on tonight — and who you might meet around it.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Compass className="h-4 w-4 text-primary" />
            Tonight nearby
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Open Discover and filter to the next eight hours. The feed is built for plans you can actually make.
          </p>
          <Button asChild size="sm">
            <Link to="/app/discovery">See tonight</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} to={s.to} className="block">
              <Card className="transition-all duration-fast hover:bg-muted/30 hover:shadow-card">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <div className="font-display text-3xl font-bold tracking-tight">{s.value}</div>
                    <div className="text-xs font-medium text-muted-foreground mt-1">{s.label}</div>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
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

        <Card>
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
