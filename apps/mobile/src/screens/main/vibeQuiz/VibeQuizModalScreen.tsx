import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppScrollView, PanelCard } from '@components/AppChrome';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';

import { VibeQuizScreen } from './VibeQuizScreen';

/**
 * Modal wrapper that lets the user (re)take the vibe quiz from anywhere in the
 * app. Persists the result and pops back on completion or skip.
 */
export const VibeQuizModalScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user, refreshProfile } = useAuth();

  const handleDone = async () => {
    try {
      await refreshProfile();
    } finally {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  };

  return (
    <AppScrollView contentContainerStyle={{ gap: 16 }}>
      <PanelCard>
        <VibeQuizScreen
          existingActivityPreferences={user?.activityPreferences}
          existingPhotoAlbum={user?.photoAlbum}
          existingInterests={user?.interests}
          onComplete={handleDone}
          onSkip={handleDone}
          markSkippedOnSave={false}
          persistOnComplete
          resultsCtaLabel="Save & close"
        />
      </PanelCard>
    </AppScrollView>
  );
};
