import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Star, Calendar, MapPin, MessageSquare } from 'lucide-react';
import { useState } from 'react';

interface AttendedActivity {
  id: number;
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  time: string;
  capacity: number;
  tags: string[];
  images: string[];
  created_at: string;
  participant_count: number;
  host?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
  };
  dateTime?: string;
  category?: string;
}

interface ReviewPayload {
  activityId: number;
  rating: number;
  review: string;
}

export default function Reviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedActivity, setSelectedActivity] = useState<AttendedActivity | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // Fetch attended activities
  const { data: attendedActivities = [] } = useQuery<AttendedActivity[]>({
    queryKey: [`/api/users/${user?.id}/attended-activities`],
    enabled: !!user?.id,
  });

  // Create review mutation
  const createReviewMutation = useMutation<Response, Error, ReviewPayload>({
    mutationFn: async (reviewData: ReviewPayload) => {
      return await apiRequest(
        'POST',
        `/api/activities/${reviewData.activityId}/reviews`,
        reviewData,
      );
    },
    onSuccess: () => {
      toast({
        title: 'Review submitted!',
        description: 'Thank you for your feedback.',
      });
      setShowReviewModal(false);
      setRating(0);
      setReviewText('');
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/attended-activities`] });
    },
    onError: (error) => {
      console.error('Error submitting review:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit review',
        variant: 'destructive',
      });
    },
  });

  const handleReviewActivity = (activity: AttendedActivity) => {
    setSelectedActivity(activity);
    setShowReviewModal(true);
  };

  const handleSubmitReview = () => {
    if (rating === 0) {
      toast({
        title: 'Rating required',
        description: 'Please select a star rating',
        variant: 'destructive',
      });
      return;
    }

    createReviewMutation.mutate({
      activityId: selectedActivity!.id,
      rating,
      review: reviewText,
    });
  };

  const renderStars = (currentRating: number, interactive: boolean = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= currentRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
            onClick={interactive ? () => setRating(star) : undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Reviews & Ratings</h1>
          <p className="text-muted-foreground">
            Share your experience and help others discover great activities
          </p>
        </div>

        <Tabs defaultValue="to-review" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="to-review">Activities to Review</TabsTrigger>
            <TabsTrigger value="my-reviews">My Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="to-review" className="space-y-4 mt-6">
            {attendedActivities.length > 0 ? (
              <div className="grid gap-4">
                {attendedActivities.map((activity: AttendedActivity) => (
                  <Card key={activity.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-lg">{activity.title}</CardTitle>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(
                                new Date(activity.time || activity.dateTime || ''),
                                'MMM d, yyyy',
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {activity.location}
                            </div>
                          </div>
                          <Badge variant="secondary">{activity.category}</Badge>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={activity.host?.profileImageUrl} />
                              <AvatarFallback>
                                {activity.host?.firstName?.[0]}
                                {activity.host?.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {activity.host?.firstName} {activity.host?.lastName}
                            </span>
                          </div>
                          <Button onClick={() => handleReviewActivity(activity)} size="sm">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Write Review
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No activities to review</h3>
                  <p className="text-muted-foreground">
                    Attend some activities to share your experience with others!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="my-reviews" className="space-y-4 mt-6">
            <Card>
              <CardContent className="text-center py-8">
                <Star className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Your reviews will appear here</h3>
                <p className="text-muted-foreground">
                  Once you submit reviews, you&apos;ll be able to see and manage them here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Review Modal */}
        <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Activity</DialogTitle>
            </DialogHeader>

            {selectedActivity && (
              <div className="space-y-6">
                {/* Activity Info */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{selectedActivity.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(
                        new Date(selectedActivity.time || selectedActivity.dateTime || ''),
                        'MMM d, yyyy',
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {selectedActivity.location}
                    </div>
                  </div>
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Overall Rating</div>
                  <div className="flex items-center gap-2">
                    {renderStars(rating, true)}
                    <span className="text-sm text-muted-foreground ml-2">
                      {rating > 0 ? `${rating} star${rating !== 1 ? 's' : ''}` : 'Select rating'}
                    </span>
                  </div>
                </div>

                {/* Review Text */}
                <div className="space-y-2">
                  <label htmlFor="review-text" className="text-sm font-medium">
                    Your Review
                  </label>
                  <Textarea
                    id="review-text"
                    placeholder="Share your experience with this activity..."
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowReviewModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={createReviewMutation.isPending || rating === 0}
                    className="flex-1"
                  >
                    {createReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
