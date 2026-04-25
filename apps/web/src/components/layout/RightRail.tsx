import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RightRail() {
  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col gap-4 border-l bg-muted/20 p-4 overflow-y-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Get matched faster
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Take the Vibe Quiz to dial in better activity recommendations.</p>
          <Button asChild size="sm" className="w-full">
            <Link to="/app/vibe-quiz">Start the quiz</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Trending nearby
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Link
            to="/app/discovery?category=outdoors"
            className="block rounded-md px-2 py-1.5 hover:bg-muted"
          >
            Hiking & outdoors
          </Link>
          <Link
            to="/app/discovery?category=food"
            className="block rounded-md px-2 py-1.5 hover:bg-muted"
          >
            Food & drinks
          </Link>
          <Link
            to="/app/discovery?category=nightlife"
            className="block rounded-md px-2 py-1.5 hover:bg-muted"
          >
            Nightlife
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Grow your circle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Connect with people you&apos;ve matched with — even outside an event.</p>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/app/connections">View connections</Link>
          </Button>
        </CardContent>
      </Card>

      <p className="px-1 text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} IRLobby ·{' '}
        <Link to="/privacy" className="hover:underline">
          Privacy
        </Link>{' '}
        ·{' '}
        <Link to="/terms" className="hover:underline">
          Terms
        </Link>
      </p>
    </aside>
  );
}
