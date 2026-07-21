import { VibeQuiz } from '@/components/vibe-quiz';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@shared/schema';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export default function VibeQuizPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const refreshAndGo = async () => {
    await queryClient.invalidateQueries({ queryKey: [API_ROUTES.USER_PROFILE] });
    await queryClient.refetchQueries({ queryKey: [API_ROUTES.USER_PROFILE] });
    navigate('/app/discovery', { replace: true });
  };

  return (
    <VibeQuiz
      existingActivityPreferences={user?.activityPreferences}
      existingPhotoAlbum={user?.photoAlbum}
      existingInterests={user?.interests}
      onComplete={() => void refreshAndGo()}
      onSkip={() => void refreshAndGo()}
      persistOnComplete
      resultsCtaLabel="See activities"
    />
  );
}
