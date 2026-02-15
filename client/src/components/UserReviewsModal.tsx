import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Star, Calendar, MapPin } from 'lucide-react';

interface Review {
  id: number;
  reviewer: string;
  reviewee: string;
  created_at: string;
  rating: number;
  activity: string;
  comment?: string;
}

interface UserReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export default function UserReviewsModal({
  isOpen,
  onClose,
  userName,
}: UserReviewsModalProps) {
  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ['/api/reviews', userName],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/reviews/');
      const allReviews = (await response.json()) as Review[];
      return allReviews.filter((review) => review.reviewee === userName);
    },
    enabled: isOpen,
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
      />
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Reviews for {userName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading reviews...</p>
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={undefined} />
                        <AvatarFallback>{review.reviewer?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{review.reviewer}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(review.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                  </div>

                  <div className="mb-3 p-2 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3 w-3" />
                      <span className="font-medium">{review.activity}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      <span>Activity review</span>
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-sm text-muted-foreground mb-2">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  )}

                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-xs">
                      Activity Review
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Star className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No reviews yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Reviews will appear here after {userName} participates in activities
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
