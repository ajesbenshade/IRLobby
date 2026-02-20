import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Surface, Text, TextInput } from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { fetchMatches } from '@services/matchService';
import { createReview, fetchReviews } from '@services/reviewService';
import { getErrorMessage } from '@utils/error';

interface ReviewOpportunity {
  matchId: number;
  activityId: number;
  activity: string;
  revieweeId: number;
  revieweeName: string;
}

export const ReviewsScreen = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedOpportunity, setSelectedOpportunity] = useState<ReviewOpportunity | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');

  const { data: matches = [], error: matchesError } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  const { data: reviews = [], error: reviewsError } = useQuery({
    queryKey: ['mobile-reviews'],
    queryFn: fetchReviews,
  });

  const createMutation = useMutation({
    mutationFn: createReview,
    onSuccess: async () => {
      setSelectedOpportunity(null);
      setRating(0);
      setComment('');
      await queryClient.invalidateQueries({ queryKey: ['mobile-reviews'] });
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

  const submitReview = () => {
    if (!selectedOpportunity || rating < 1) {
      return;
    }

    createMutation.mutate({
      activityId: selectedOpportunity.activityId,
      revieweeId: selectedOpportunity.revieweeId,
      rating,
      comment: comment.trim(),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall">Reviews</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Rate your matched activities and participants.
      </Text>

      {(matchesError || reviewsError) && (
        <HelperText type="error" visible>
          {getErrorMessage(matchesError ?? reviewsError, 'Unable to load reviews.')}
        </HelperText>
      )}

      <Card>
        <Card.Title title="Pending reviews" />
        <Card.Content style={styles.listContent}>
          {opportunities.length === 0 && <Text>No pending reviews right now.</Text>}
          {opportunities.map((item) => (
            <Surface key={`${item.matchId}-${item.revieweeId}`} elevation={1} style={styles.itemCard}>
              <Text variant="titleSmall">{item.activity}</Text>
              <Text variant="bodySmall">Review {item.revieweeName}</Text>
              <Button mode="outlined" onPress={() => setSelectedOpportunity(item)}>
                Write review
              </Button>
            </Surface>
          ))}
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="My reviews" />
        <Card.Content style={styles.listContent}>
          {myReviews.length === 0 && <Text>No submitted reviews yet.</Text>}
          {myReviews.map((review) => (
            <Surface key={review.id} elevation={1} style={styles.itemCard}>
              <Text variant="titleSmall">{review.activity}</Text>
              <Text variant="bodySmall">For {review.reviewee}</Text>
              <Text>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
              {!!review.comment && <Text>{review.comment}</Text>}
            </Surface>
          ))}
        </Card.Content>
      </Card>

      {selectedOpportunity && (
        <Card>
          <Card.Title title="Write review" />
          <Card.Content style={styles.listContent}>
            <Text>{selectedOpportunity.activity} · {selectedOpportunity.revieweeName}</Text>
            <TextInput
              label="Rating (1-5)"
              value={rating ? String(rating) : ''}
              onChangeText={(value) => setRating(Math.max(0, Math.min(5, Number(value) || 0)))}
              keyboardType="number-pad"
              style={styles.input}
            />
            <TextInput
              label="Comment"
              value={comment}
              onChangeText={setComment}
              multiline
              style={styles.input}
            />
            {createMutation.error && (
              <HelperText type="error" visible>
                {getErrorMessage(createMutation.error, 'Unable to submit review.')}
              </HelperText>
            )}
            <View style={styles.actions}>
              <Button mode="outlined" onPress={() => setSelectedOpportunity(null)}>
                Cancel
              </Button>
              <Button
                mode="contained"
                disabled={rating < 1 || createMutation.isPending}
                loading={createMutation.isPending}
                onPress={submitReview}
              >
                Submit
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  subtitle: {
    opacity: 0.75,
  },
  listContent: {
    gap: 10,
  },
  itemCard: {
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  input: {
    backgroundColor: 'transparent',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});
