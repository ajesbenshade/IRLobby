import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Calendar, MapPin, User, MessageSquare, Camera } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Reviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  // Fetch attended activities
  const { data: attendedActivities = [] } = useQuery<any>({
    queryKey: [`/api/users/${user?.id}/attended-activities`],
    enabled: !!user?.id,
  });

  // Create review mutation
  const createReviewMutation = useMutation({
    mutationFn: async (reviewData: any) => {
      return await apiRequest(`/api/activities/${reviewData.activityId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          rating: reviewData.rating,
          review: reviewData.review,
          photos: []
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Review submitted!",
        description: "Thank you for your feedback.",
      });
      setShowReviewModal(false);
      setSelectedActivity(null);
      setRating(0);
      setReviewText("");
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/attended-activities`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    },
  });

  const handleReviewActivity = (activity: any) => {
    setSelectedActivity(activity);
    setShowReviewModal(true);
  };

  const handleSubmitReview = () => {
    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating",
        variant: "destructive",
      });
      return;
    }

    createReviewMutation.mutate({
      activityId: selectedActivity.id,
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
              star <= currentRating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            } ${interactive ? "cursor-pointer hover:text-yellow-400" : ""}`}
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
                {attendedActivities.map((activity: any) => (
                  <Card key={activity.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-lg">{activity.title}</CardTitle>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(activity.dateTime), 'MMM d, yyyy')}
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
                                {activity.host?.firstName?.[0]}{activity.host?.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {activity.host?.firstName} {activity.host?.lastName}
                            </span>
                          </div>
                          <Button 
                            onClick={() => handleReviewActivity(activity)}
                            size="sm"
                          >
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
                  Once you submit reviews, you'll be able to see and manage them here.
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
                      {format(new Date(selectedActivity.dateTime), 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {selectedActivity.location}
                    </div>
                  </div>
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Overall Rating</label>
                  <div className="flex items-center gap-2">
                    {renderStars(rating, true)}
                    <span className="text-sm text-muted-foreground ml-2">
                      {rating > 0 ? `${rating} star${rating !== 1 ? 's' : ''}` : 'Select rating'}
                    </span>
                  </div>
                </div>

                {/* Review Text */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Review</label>
                  <Textarea
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
                    {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
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