import { AddToCalendarDialog } from '@/components/foyer/FoyerSheets';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { gatheringCalendarUrls, openCalendarUrl } from '@/lib/calendar';
import { compressImageFile } from '@/lib/foyer';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTE_BUILDERS, API_ROUTES } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { format, isValid } from 'date-fns';
import { ArrowLeft, Clock, MapPin, Star, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

interface ActivityHost {
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
  rating?: number;
  eventsHosted?: number;
  events_hosted?: number;
}

interface ActivityDetail {
  id: number | string;
  title?: string;
  calendar_links?: {
    ics_url?: string | null;
    webcal_url?: string | null;
    google_url?: string | null;
    outlook_url?: string | null;
  } | null;
  description?: string;
  location?: string;
  time?: string;
  dateTime?: string;
  date_time?: string;
  capacity?: number;
  participant_count?: number;
  tags?: string[] | string;
  images?: string[];
  host?: ActivityHost;
}

function pick<T>(...vals: (T | undefined | null)[]) {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}

export default function ActivityDetailPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCalendar, setShowCalendar] = useState(false);

  const route = `${API_ROUTES.ACTIVITIES}${activityId}/`;

  const { data, isLoading, isError } = useQuery<ActivityDetail>({
    queryKey: [route],
    enabled: Boolean(activityId),
    queryFn: async () => {
      const res = await apiRequest('GET', route);
      return (await res.json()) as ActivityDetail;
    },
  });

  const join = useMutation({
    mutationFn: async () => {
      if (!activityId) return;
      await apiRequest('POST', API_ROUTE_BUILDERS.activityJoin(activityId), {});
    },
    onSuccess: () => {
      toast({ title: 'Joined!', description: "You're in. Check matches to chat." });
      qc.invalidateQueries({ queryKey: [route] });
      qc.invalidateQueries({ queryKey: [API_ROUTES.MATCHES] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Could not join activity.';
      toast({ title: 'Unable to join', description: msg, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
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
            We couldn&apos;t load this activity. It may have been removed.
          </CardContent>
        </Card>
      </div>
    );
  }

  const a = data;
  const safeTitle = a.title || 'Untitled activity';
  const safeTags = Array.isArray(a.tags)
    ? a.tags
    : typeof a.tags === 'string' && a.tags.trim().length > 0
    ? [a.tags]
    : [];
  const rawTime = a.time || a.dateTime || a.date_time;
  const parsed = rawTime ? new Date(rawTime) : null;
  const validDate = Boolean(parsed && isValid(parsed));

  const host = a.host;
  const hostFirst = pick(host?.firstName, host?.first_name) ?? '';
  const hostLast = pick(host?.lastName, host?.last_name) ?? '';
  const hostName = `${hostFirst} ${hostLast}`.trim() || 'Anonymous host';
  const hostAvatar = pick(host?.profileImageUrl, host?.profile_image_url);
  const hostInitials = (hostFirst[0] ?? 'H') + (hostLast[0] ?? '');
  const eventsHosted = pick(host?.eventsHosted, host?.events_hosted) ?? 0;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/app/discovery">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to discovery
        </Link>
      </Button>

      <div className="overflow-hidden rounded-xl">
        <div className="relative h-64 w-full bg-gradient-to-br from-primary/20 to-primary-deep/20">
          {a.images && a.images.length > 0 ? (
            <img src={a.images[0]} alt={safeTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl font-bold text-[#6e6a68]">
              {safeTitle.charAt(0)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{safeTitle}</h1>
        {safeTags[0] && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            {safeTags[0]}
          </Badge>
        )}
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        {a.location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>{a.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>
            {validDate && parsed
              ? `${format(parsed, 'EEEE, MMM d, yyyy')} · ${format(parsed, 'h:mm a')}`
              : 'Date TBD'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>
            {a.participant_count ?? 0} of {a.capacity ?? 0} spots filled
          </span>
        </div>
      </div>
      <button
        type="button"
        className="h-[52px] w-full rounded-2xl bg-[#f9e8ee] font-semibold text-[#a2033f]"
        onClick={() => setShowCalendar(true)}
      >
        Add to calendar
      </button>

      {a.description && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h2 className="text-sm font-semibold">What to expect</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{a.description}</p>
          </CardContent>
        </Card>
      )}

      {safeTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {safeTags.map((t, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={hostAvatar} />
            <AvatarFallback>{hostInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">{hostName}</p>
            <p className="text-xs text-muted-foreground">{eventsHosted} events hosted</p>
          </div>
          {host?.rating ? (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 text-yellow-500" />
              {host.rating.toFixed(1)}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <label className="block rounded-2xl border border-dashed border-[#e1dbd7] bg-white p-4 text-sm">
        <span className="font-semibold text-[#a2033f]">Add a photo</span>
        <span className="mt-1 block text-[#6e6a68]">Up to 8 photos. Hosts and people who are going can add them.</span>
        <input
          aria-label="Add a gathering photo"
          type="file"
          accept="image/*"
          className="mt-2 block w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file || !activityId) return;
            void (async () => {
              const blob = await compressImageFile(file);
              const body = new FormData();
              body.append('image', blob, 'photo.jpg');
              await fetch(`/api/activities/${activityId}/photos/`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('authToken') ?? ''}` },
                body,
              });
              await qc.invalidateQueries({ queryKey: [route] });
            })();
          }}
        />
      </label>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 p-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <Button
          onClick={() => join.mutate()}
          disabled={join.isPending}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {join.isPending ? 'Joining…' : 'Join event'}
        </Button>
      </div>
      {showCalendar && activityId ? (
        <AddToCalendarDialog
          onGoogle={() => openCalendarUrl(gatheringCalendarUrls(a).google)}
          onOutlook={() => openCalendarUrl(gatheringCalendarUrls(a).outlook)}
          onApple={() => openCalendarUrl(gatheringCalendarUrls(a).apple)}
          onDismiss={() => setShowCalendar(false)}
        />
      ) : null}
    </div>
  );
}
