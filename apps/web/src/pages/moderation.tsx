import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES, API_ROUTE_BUILDERS } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

interface BlockedUserItem {
  id: number;
  blocked: number;
  blocked_username: string;
}

type ReportReason =
  | 'harassment'
  | 'spam'
  | 'hate_speech'
  | 'impersonation'
  | 'unsafe_behavior'
  | 'other';

const REPORT_REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'unsafe_behavior', label: 'Unsafe behavior' },
  { value: 'other', label: 'Other' },
];

export default function ModerationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [reportedUserId, setReportedUserId] = useState(searchParams.get('userId') ?? '');
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId) {
      setReportedUserId(userId);
    }
  }, [searchParams]);

  const reportedUserName = searchParams.get('name');

  const {
    data: blockedUsers = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<BlockedUserItem[]>({
    queryKey: [API_ROUTES.MODERATION_BLOCKED],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MODERATION_BLOCKED);
      return (await response.json()) as BlockedUserItem[];
    },
    retry: 1,
  });

  const unblockMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest('DELETE', API_ROUTE_BUILDERS.moderationUnblock(userId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.MODERATION_BLOCKED] });
      toast({ title: 'User unblocked', description: 'They can appear in discovery again.' });
    },
    onError: (mutationError: unknown) => {
      toast({
        title: 'Unable to unblock user',
        description: mutationError instanceof Error ? mutationError.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const userId = Number(reportedUserId);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error('Enter a valid user ID to submit a report.');
      }

      const response = await apiRequest('POST', API_ROUTES.MODERATION_REPORT, {
        reported_user: userId,
        reason,
        description,
      });
      return response.json();
    },
    onSuccess: () => {
      setDescription('');
      toast({
        title: 'Report submitted',
        description: 'Thanks. The moderation team can now review it.',
      });
    },
    onError: (mutationError: unknown) => {
      toast({
        title: 'Unable to submit report',
        description: mutationError instanceof Error ? mutationError.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Safety & moderation</h1>
        <p className="text-sm text-muted-foreground">
          Manage blocked accounts and send a report when someone crosses a line.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Blocked accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {error ? (
            <div className="space-y-3">
              <p>{error instanceof Error ? error.message : 'Unable to load blocked users.'}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
                disabled={isRefetching}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {isRefetching ? 'Refreshing...' : 'Refresh list'}
              </Button>
            </div>
          ) : isLoading ? (
            <p>Loading blocked accounts...</p>
          ) : blockedUsers.length === 0 ? (
            <>
              <p>You haven&apos;t blocked anyone yet.</p>
              <p>
                From any profile, you can block someone to keep them out of discovery, matches, and
                conversations.
              </p>
            </>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-foreground">{item.blocked_username}</p>
                    <p className="text-xs text-muted-foreground">
                      Hidden from your feed and match flow
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unblockMutation.mutate(item.blocked)}
                    disabled={unblockMutation.isPending}
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report a user</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {reportedUserName ? (
            <p>
              Reporting <span className="font-medium text-foreground">{reportedUserName}</span>.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="reported-user-id">Reported user ID</Label>
            <Input
              id="reported-user-id"
              value={reportedUserId}
              onChange={(event) => setReportedUserId(event.target.value)}
              placeholder="Enter the user ID"
              inputMode="numeric"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as ReportReason)}>
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-description">What happened?</Label>
            <Textarea
              id="report-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Share the details that matter. HTML and scripts are stripped automatically."
              rows={5}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending || description.trim().length === 0}
            >
              {reportMutation.isPending ? 'Submitting...' : 'Submit report'}
            </Button>
            <Link to="/app/help-support" className="text-primary underline underline-offset-4">
              Contact support instead
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
