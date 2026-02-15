import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { API_ROUTES } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Star } from 'lucide-react';
import { useMemo, useState } from 'react';

interface MatchItem {
  id: number;
  activity_id?: number | null;
  activity: string;
  user_a_id?: number;
  user_a: string;
  user_b_id?: number;
  user_b: string;
  created_at: string;
}

interface ReviewItem {
  id: number;
  reviewerId: number;
  reviewer: string;
  revieweePk: number;
  reviewee: string;
  activityPk: number;
  activity: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface ReviewPayload {
  revieweeId: number;
  activityId: number;
  rating: number;
  comment: string;
}

interface ReviewOpportunity {
  matchId: number;
  activityId: number;
  activity: string;
  revieweeId: number;
  revieweeName: string;
}

export default function Reviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOpportunity, setSelectedOpportunity] = useState<ReviewOpportunity | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const { data: matches = [] } = useQuery<MatchItem[]>({
    queryKey: [API_ROUTES.MATCHES],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.MATCHES);
      return response.json();
    },
    enabled: !!user,
  });

  const { data: reviews = [] } = useQuery<ReviewItem[]>({
    queryKey: [API_ROUTES.REVIEWS],
    queryFn: async () => {
      const response = await apiRequest('GET', API_ROUTES.REVIEWS);
      return response.json();
    },
    enabled: !!user,
  });

  const createReviewMutation = useMutation({
    mutationFn: async (payload: ReviewPayload) => {
      const response = await apiRequest('POST', API_ROUTES.REVIEWS, payload);
      if (!response.ok) {
        throw new Error('Failed to submit review');
      }
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: 'Review submitted', description: 'Thanks for sharing your feedback.' });
      setSelectedOpportunity(null);
      setRating(0);
      setComment('');
      await queryClient.invalidateQueries({ queryKey: [API_ROUTES.REVIEWS] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Could not submit review.', variant: 'destructive' });
    },
  });

  const opportunities = useMemo<ReviewOpportunity[]>(() => {
    if (!user) {
      return [];
    }

    const userId = Number(user.id);
    const reviewedKeys = new Set(
      reviews
        .filter((review) => review.reviewerId === userId)
        .map((review) => `${review.activityPk}:${review.revieweePk}`),
    );

    return matches
      .filter((match) => Boolean(match.activity_id) && Boolean(match.user_a_id) && Boolean(match.user_b_id))
      .map((match) => {
        const isUserA = match.user_a_id === userId;
        return {
          matchId: match.id,
          activityId: Number(match.activity_id),
          activity: match.activity,
          revieweeId: isUserA ? Number(match.user_b_id) : Number(match.user_a_id),
          revieweeName: isUserA ? match.user_b : match.user_a,
        };
      })
      .filter((item) => item.revieweeId !== userId)
      .filter((item) => !reviewedKeys.has(`${item.activityId}:${item.revieweeId}`));
  }, [matches, reviews, user]);

  const myReviews = useMemo(() => {
    if (!user) {
      return [];
    }
    return reviews.filter((review) => review.reviewerId === Number(user.id));
  }, [reviews, user]);

  const openReview = (item: ReviewOpportunity) => {
    setSelectedOpportunity(item);
    setRating(0);
    setComment('');
  };

  const submitReview = () => {
    if (!selectedOpportunity || rating < 1) {
      return;
    }

    createReviewMutation.mutate({
      revieweeId: selectedOpportunity.revieweeId,
      activityId: selectedOpportunity.activityId,
      rating,
      comment: comment.trim(),
    });
  };

  const renderStars = (value: number, interactive = false) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} ${interactive ? 'cursor-pointer' : ''}`}
          onClick={interactive ? () => setRating(star) : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-sm text-muted-foreground">Rate your matched activities and participants.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Pending Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending reviews right now.</p>
            ) : (
              opportunities.map((item) => (
                <div key={`${item.matchId}-${item.revieweeId}`} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="font-medium">{item.activity}</p>
                    <p className="text-sm text-muted-foreground">Review {item.revieweeName}</p>
                  </div>
                  <Button size="sm" onClick={() => openReview(item)}>
                    Write review
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submitted reviews yet.</p>
            ) : (
              myReviews.map((review) => (
                <div key={review.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{review.activity}</p>
                      <p className="text-sm text-muted-foreground">For {review.reviewee}</p>
                    </div>
                    <Badge variant="secondary">{format(new Date(review.created_at), 'MMM d, yyyy')}</Badge>
                  </div>
                  {renderStars(review.rating)}
                  {review.comment ? <p className="text-sm">{review.comment}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedOpportunity} onOpenChange={() => setSelectedOpportunity(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write review</DialogTitle>
          </DialogHeader>

          {selectedOpportunity && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {selectedOpportunity.activity} · {selectedOpportunity.revieweeName}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Rating</p>
                {renderStars(rating, true)}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Comment</p>
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Share your experience"
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedOpportunity(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={rating < 1 || createReviewMutation.isPending}
                  onClick={submitReview}
                >
                  {createReviewMutation.isPending ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
