import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button, HelperText, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  type VibeAnswers,
  type VibeQuizResult,
  type VibeTag,
} from '@shared/schema';

import { Text as NativeText, View } from '@components/RNCompat';
import { updateOnboarding } from '@services/authService';
import { appColors, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';
import {
  deriveLegacyActivityPreferences,
  deriveLegacyInterests,
  scoreVibe,
} from '@utils/vibeScoring';

import { ConfettiBurst } from './ConfettiBurst';
import { VIBE_QUESTIONS, type VibeQuestion } from './questions';
import { VibeOptionCard, VibeProgressBar } from './VibeQuestionCard';
import { useVibeQuizPersistence } from './useVibeQuizPersistence';
import { VibeQuizResultsView } from './VibeQuizResultsView';

type Phase = 'intro' | 'question' | 'results';

export interface VibeQuizScreenProps {
  /** Existing activity preferences to merge into the saved payload. */
  existingActivityPreferences?: Record<string, unknown>;
  /** Existing photo album so the onboarding payload doesn't drop it. */
  existingPhotoAlbum?: string[];
  /** Existing interests so we don't blow them away with the legacy mapping. */
  existingInterests?: string[];
  /** Called after the quiz successfully saves and the user taps the final CTA. */
  onComplete: (result: VibeQuizResult) => void | Promise<void>;
  /** Called when the user taps "Skip for now". */
  onSkip: () => void | Promise<void>;
  /** When true, marks the saved payload as `vibeQuizSkipped: true`. */
  markSkippedOnSave?: boolean;
  /** When true, the screen also persists the result via `updateOnboarding`. */
  persistOnComplete?: boolean;
  /** Override the primary CTA label on the results screen. */
  resultsCtaLabel?: string;
}

const FOOTER_GRADIENT: readonly [string, string, string] = [appColors.primary, '#9333EA', appColors.accent];

export const VibeQuizScreen = ({
  existingActivityPreferences,
  existingPhotoAlbum,
  existingInterests,
  onComplete,
  onSkip,
  markSkippedOnSave = false,
  persistOnComplete = true,
  resultsCtaLabel = 'See My Matches →',
}: VibeQuizScreenProps) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<VibeAnswers>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [resumePromptVisible, setResumePromptVisible] = useState(false);

  const { loaded, saveProgress, clearProgress, saveResult } = useVibeQuizPersistence();

  // Show the resume prompt once the persisted state has loaded and contains
  // partial progress (at least one answer recorded on the question phase).
  useEffect(() => {
    if (loaded.status !== 'loaded' || !loaded.state) return;
    const hasPartial =
      loaded.state.phase === 'question' && Object.keys(loaded.state.answers ?? {}).length > 0;
    if (hasPartial) setResumePromptVisible(true);
  }, [loaded]);

  // Persist progress whenever the user makes meaningful state changes while in
  // the question phase. We intentionally skip persistence on intro/results.
  useEffect(() => {
    if (phase !== 'question') return;
    saveProgress({ phase, currentIndex, answers });
  }, [phase, currentIndex, answers, saveProgress]);

  const slide = useSharedValue(0);

  const totalQuestions = VIBE_QUESTIONS.length;
  const currentQuestion: VibeQuestion = VIBE_QUESTIONS[currentIndex];

  const isAnswered = useMemo(() => {
    if (!currentQuestion) return false;
    const value = answers[currentQuestion.id];
    if (currentQuestion.multiSelect) {
      return Array.isArray(value) && value.length > 0;
    }
    return typeof value === 'string' && value.length > 0;
  }, [answers, currentQuestion]);

  const allAnswered = useMemo(
    () =>
      VIBE_QUESTIONS.every((question) => {
        const value = answers[question.id];
        if (question.multiSelect) return Array.isArray(value) && value.length > 0;
        return typeof value === 'string' && value.length > 0;
      }),
    [answers],
  );

  const result = useMemo<VibeQuizResult | null>(() => {
    if (!allAnswered) return null;
    return scoreVibe(answers);
  }, [allAnswered, answers]);

  const saveMutation = useMutation({
    mutationFn: async (quizResult: VibeQuizResult) => {
      const baseActivityPrefs = existingActivityPreferences ?? {};
      const merged = deriveLegacyActivityPreferences(quizResult, baseActivityPrefs);
      if (markSkippedOnSave) {
        const vibe = merged.vibe as Record<string, unknown>;
        merged.vibe = { ...vibe, vibeQuizSkipped: true };
      }
      const interests = Array.from(
        new Set([...(existingInterests ?? []), ...deriveLegacyInterests(quizResult)]),
      ).slice(0, 20);
      await updateOnboarding({
        interests,
        activity_preferences: merged,
        photo_album: existingPhotoAlbum,
      });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const baseActivityPrefs = existingActivityPreferences ?? {};
      const existingVibe =
        (baseActivityPrefs.vibe as Record<string, unknown> | undefined) ?? {};
      const nextActivityPrefs = {
        ...baseActivityPrefs,
        vibe: { ...existingVibe, vibeQuizSkipped: true },
      };
      await updateOnboarding({
        activity_preferences: nextActivityPrefs,
        photo_album: existingPhotoAlbum,
      });
    },
  });

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value }],
    opacity: 1 - Math.min(1, Math.abs(slide.value) / 320),
  }));

  const animateAdvance = useCallback(
    (direction: 'forward' | 'back', after: () => void) => {
      const offset = direction === 'forward' ? -60 : 60;
      slide.value = withTiming(offset, { duration: 160, easing: Easing.out(Easing.quad) }, () => {
        slide.value = -offset;
      });
      // Snap to next state immediately so React state stays in sync,
      // then settle the slide back to centre.
      after();
      slide.value = withSpring(0, { damping: 16, stiffness: 180, mass: 0.8 });
    },
    [slide],
  );

  const startQuiz = () => {
    setErrorMessage(null);
    setResumePromptVisible(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('question');
  };

  const resumeQuiz = () => {
    if (!loaded.state) return;
    setErrorMessage(null);
    setResumePromptVisible(false);
    setAnswers(loaded.state.answers ?? {});
    setCurrentIndex(Math.min(loaded.state.currentIndex ?? 0, VIBE_QUESTIONS.length - 1));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('question');
  };

  const startOver = () => {
    setResumePromptVisible(false);
    setAnswers({});
    setCurrentIndex(0);
    void clearProgress();
  };

  const handleSkip = async () => {
    setErrorMessage(null);
    try {
      if (persistOnComplete) {
        await skipMutation.mutateAsync();
      }
      await clearProgress();
      await onSkip();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Unable to skip the quiz right now.'));
    }
  };

  const selectAnswer = (questionId: VibeQuestion['id'], value: string) => {
    if (resumePromptVisible) setResumePromptVisible(false);
    setAnswers((previous) => {
      const question = VIBE_QUESTIONS.find((entry) => entry.id === questionId);
      if (!question) return previous;
      if (!question.multiSelect) {
        return { ...previous, [questionId]: value };
      }
      const current = (previous[questionId] as VibeTag[] | undefined) ?? [];
      const isSelected = current.includes(value as VibeTag);
      if (isSelected) {
        return { ...previous, [questionId]: current.filter((tag) => tag !== value) };
      }
      const max = question.maxSelections ?? current.length + 1;
      if (current.length >= max) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return previous;
      }
      return { ...previous, [questionId]: [...current, value as VibeTag] };
    });
  };

  const goNext = () => {
    if (!isAnswered) return;
    if (currentIndex < totalQuestions - 1) {
      animateAdvance('forward', () => setCurrentIndex(currentIndex + 1));
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase('results');
  };

  const goBack = () => {
    if (currentIndex === 0) {
      animateAdvance('back', () => setPhase('intro'));
      return;
    }
    animateAdvance('back', () => setCurrentIndex(currentIndex - 1));
  };

  const handleResultsCta = async () => {
    if (!result) return;
    setErrorMessage(null);
    setConfettiVisible(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      if (persistOnComplete) {
        await saveMutation.mutateAsync(result);
      }
      await saveResult(result);
      await clearProgress();
      await onComplete(result);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not save your vibe just yet — try again.'));
    }
  };

  if (phase === 'intro') {
    return (
      <View style={styles.intro}>
        <View style={styles.heroEmojiRow}>
          <NativeText style={styles.heroEmoji}>🎉</NativeText>
          <NativeText style={styles.heroEmojiSmall}>✨</NativeText>
          <NativeText style={styles.heroEmoji}>🔥</NativeText>
        </View>
        <Text variant="headlineLarge" style={styles.introTitle}>
          Let’s find your vibe 🔥
        </Text>
        <Text style={styles.introSubtitle}>
          5 quick questions → instant personalized IRL hangouts.
        </Text>
        {resumePromptVisible ? (
          <View style={styles.resumeCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss resume prompt"
              onPress={() => setResumePromptVisible(false)}
              style={styles.resumeDismiss}
              hitSlop={12}
            >
              <NativeText style={styles.resumeDismissText}>×</NativeText>
            </Pressable>
            <NativeText style={styles.resumeTitle}>Pick up where you left off?</NativeText>
            <NativeText style={styles.resumeBody}>
              You started this quiz earlier. Resume or start fresh.
            </NativeText>
            <View style={styles.resumeActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Resume the vibe quiz"
                onPress={resumeQuiz}
                style={({ pressed }) => [styles.resumeButton, pressed && styles.resumeButtonPressed]}
              >
                <NativeText style={styles.resumeButtonText}>Resume</NativeText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start the vibe quiz over"
                onPress={startOver}
              >
                <NativeText style={styles.resumeStartOver}>Start over</NativeText>
              </Pressable>
            </View>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start the vibe quiz"
          onPress={startQuiz}
          style={({ pressed }) => [styles.primaryButtonWrap, pressed ? styles.primaryButtonPressed : null]}
        >
          <LinearGradient
            colors={FOOTER_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButton}
          >
            <NativeText style={styles.primaryButtonText}>Start the Quiz</NativeText>
          </LinearGradient>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={handleSkip} disabled={skipMutation.isPending}>
          <Text style={styles.skipText}>{skipMutation.isPending ? 'Skipping…' : 'Skip for now'}</Text>
        </Pressable>
        {errorMessage ? (
          <HelperText type="error" visible style={styles.error}>
            {errorMessage}
          </HelperText>
        ) : null}
      </View>
    );
  }

  if (phase === 'results' && result) {
    return (
      <View style={styles.resultsContainer}>
        <ConfettiBurst visible={confettiVisible} />
        <VibeQuizResultsView
          vibeProfile={result.vibeProfile}
          vibeTags={result.vibeTags}
          discoverTags={result.discoverTags}
          ctaLabel={resultsCtaLabel}
          onCta={() => void handleResultsCta()}
          isCtaPending={saveMutation.isPending}
          errorMessage={errorMessage}
        />
      </View>
    );
  }

  return (
    <View style={styles.questionContainer}>
      <VibeProgressBar current={currentIndex + 1} total={totalQuestions} />
      <Animated.View style={[styles.questionInner, slideStyle]}>
        <Text variant="headlineSmall" style={styles.questionPrompt}>
          {currentQuestion.prompt}
        </Text>
        <Text style={styles.questionHelper}>{currentQuestion.helper}</Text>
        <View style={styles.optionList}>
          {currentQuestion.options.map((option) => {
            const value = answers[currentQuestion.id];
            const selected = currentQuestion.multiSelect
              ? Array.isArray(value) && (value as string[]).includes(option.value)
              : value === option.value;
            return (
              <VibeOptionCard
                key={option.value}
                emoji={option.emoji}
                label={option.label}
                helper={option.helper}
                selected={selected}
                onPress={() => selectAnswer(currentQuestion.id, option.value)}
              />
            );
          })}
        </View>
      </Animated.View>
      <View style={styles.questionFooter}>
        <Button mode="text" onPress={goBack}>
          Back
        </Button>
        <Button
          mode="contained"
          onPress={goNext}
          disabled={!isAnswered}
        >
          {currentIndex === totalQuestions - 1 ? 'See my vibe' : 'Next'}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  intro: {
    gap: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  heroEmojiRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  heroEmoji: {
    fontSize: 60,
  },
  heroEmojiSmall: {
    fontSize: 40,
  },
  resumeCard: {
    position: 'relative',
    width: '100%',
    backgroundColor: appColors.cardStrong,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  resumeDismiss: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeDismissText: {
    color: appColors.mutedInk,
    fontSize: 22,
    lineHeight: 24,
  },
  resumeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.ink,
    textAlign: 'center',
  },
  resumeBody: {
    fontSize: 13,
    color: appColors.mutedInk,
    textAlign: 'center',
  },
  resumeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  resumeButton: {
    backgroundColor: appColors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  resumeButtonPressed: {
    opacity: 0.85,
  },
  resumeButtonText: {
    color: appColors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  resumeStartOver: {
    color: appColors.mutedInk,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  introTitle: {
    color: appColors.ink,
    fontWeight: '800',
    textAlign: 'center',
  },
  introSubtitle: {
    color: appColors.mutedInk,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  primaryButtonWrap: {
    width: '100%',
    borderRadius: radii.pill,
    shadowColor: appColors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  primaryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  skipText: {
    color: appColors.softInk,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: appColors.danger,
    textAlign: 'center',
  },
  questionContainer: {
    gap: spacing.md,
  },
  questionInner: {
    gap: spacing.md,
  },
  questionPrompt: {
    color: appColors.ink,
    fontWeight: '800',
  },
  questionHelper: {
    color: appColors.mutedInk,
    fontSize: 13,
    fontWeight: '500',
  },
  optionList: {
    gap: spacing.sm,
  },
  questionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  resultsContainer: {
    gap: spacing.lg,
    alignItems: 'stretch',
  },
});
