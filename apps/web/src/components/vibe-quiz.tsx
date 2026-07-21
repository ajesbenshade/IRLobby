import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVibeQuizPersistence } from '@/hooks/useVibeQuizPersistence';
import { apiRequest } from '@/lib/queryClient';
import {
  API_ROUTES,
  VIBE_PROFILE_LABELS,
  type VibeAnswers,
  type VibeQuizResult,
  type VibeTag,
} from '@shared/schema';
import {
  VIBE_QUESTIONS,
  type VibeQuestion,
} from '@shared/vibeQuestions';
import {
  deriveLegacyActivityPreferences,
  deriveLegacyInterests,
  scoreVibe,
} from '@shared/vibeScoring';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Phase = 'intro' | 'question' | 'results';

export interface VibeQuizProps {
  existingActivityPreferences?: Record<string, unknown>;
  existingPhotoAlbum?: string[];
  existingInterests?: string[];
  onComplete: (result: VibeQuizResult) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  markSkippedOnSave?: boolean;
  persistOnComplete?: boolean;
  resultsCtaLabel?: string;
}

export function VibeQuiz({
  existingActivityPreferences,
  existingPhotoAlbum,
  existingInterests,
  onComplete,
  onSkip,
  markSkippedOnSave = false,
  persistOnComplete = true,
  resultsCtaLabel = 'See activities',
}: VibeQuizProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<VibeAnswers>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resumePromptVisible, setResumePromptVisible] = useState(false);

  const { loaded, saveProgress, clearProgress, saveResult } = useVibeQuizPersistence();

  useEffect(() => {
    if (loaded.status !== 'loaded' || !loaded.state) return;
    const hasPartial =
      loaded.state.phase === 'question' && Object.keys(loaded.state.answers ?? {}).length > 0;
    if (hasPartial) setResumePromptVisible(true);
  }, [loaded]);

  useEffect(() => {
    if (phase !== 'question') return;
    saveProgress({ phase, currentIndex, answers });
  }, [phase, currentIndex, answers, saveProgress]);

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
      await apiRequest('PATCH', API_ROUTES.USER_ONBOARDING, {
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
      await apiRequest('PATCH', API_ROUTES.USER_ONBOARDING, {
        activity_preferences: nextActivityPrefs,
        photo_album: existingPhotoAlbum,
      });
    },
  });

  const startQuiz = () => {
    setErrorMessage(null);
    setResumePromptVisible(false);
    setPhase('question');
  };

  const resumeQuiz = () => {
    if (!loaded.state) return;
    setErrorMessage(null);
    setResumePromptVisible(false);
    setAnswers(loaded.state.answers ?? {});
    setCurrentIndex(Math.min(loaded.state.currentIndex ?? 0, VIBE_QUESTIONS.length - 1));
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
      setErrorMessage(error instanceof Error ? error.message : 'Unable to skip the quiz right now.');
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
      if (current.length >= max) return previous;
      return { ...previous, [questionId]: [...current, value as VibeTag] };
    });
  };

  const goNext = () => {
    if (!isAnswered) return;
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }
    setPhase('results');
  };

  const goBack = () => {
    if (currentIndex === 0) {
      setPhase('intro');
      return;
    }
    setCurrentIndex(currentIndex - 1);
  };

  const handleResultsCta = async () => {
    if (!result) return;
    setErrorMessage(null);
    try {
      if (persistOnComplete) {
        await saveMutation.mutateAsync(result);
      }
      await saveResult(result);
      await clearProgress();
      await onComplete(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save your vibe just yet — try again.',
      );
    }
  };

  if (phase === 'intro') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discover your vibe</h1>
          <p className="text-sm text-muted-foreground">
            5 quick questions. Get perfectly matched plans that actually fit you.
          </p>
        </div>

        {resumePromptVisible ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pick up where you left off?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You started this quiz earlier. Resume or start fresh.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={resumeQuiz} size="sm">
                  Resume
                </Button>
                <Button onClick={startOver} variant="outline" size="sm">
                  Start over
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={startQuiz}>Start the quiz</Button>
          <Button onClick={() => void handleSkip()} variant="ghost" disabled={skipMutation.isPending}>
            Skip for now
          </Button>
        </div>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      </div>
    );
  }

  if (phase === 'results' && result) {
    const profile = VIBE_PROFILE_LABELS[result.vibeProfile];
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your vibe</h1>
          <p className="text-sm text-muted-foreground">Locked in — Discover will use this to seed filters.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {profile.emoji} {profile.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{profile.tagline}</p>
            <div className="flex flex-wrap gap-2">
              {result.discoverTags.map((tag) => (
                <span key={tag} className="rounded-full border bg-muted px-3 py-1 text-xs">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => void handleResultsCta()}
                size="sm"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : resultsCtaLabel}
              </Button>
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPct = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vibe Quiz</h1>
        <p className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {totalQuestions}
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{currentQuestion.prompt}</CardTitle>
          <p className="text-sm text-muted-foreground">{currentQuestion.helper}</p>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {currentQuestion.options.map((option) => {
            const selected = currentQuestion.multiSelect
              ? ((answers[currentQuestion.id] as VibeTag[] | undefined) ?? []).includes(
                  option.value as VibeTag,
                )
              : answers[currentQuestion.id] === option.value;
            return (
              <Button
                key={option.value}
                variant={selected ? 'default' : 'outline'}
                className="h-auto justify-start py-3 text-left"
                onClick={() => selectAnswer(currentQuestion.id, option.value)}
              >
                <span className="mr-2">{option.emoji}</span>
                <span>
                  <span className="block">{option.label}</span>
                  {option.helper ? (
                    <span className="block text-xs opacity-80">{option.helper}</span>
                  ) : null}
                </span>
              </Button>
            );
          })}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={goBack}>
          Back
        </Button>
        <Button onClick={goNext} disabled={!isAnswered}>
          {currentIndex === totalQuestions - 1 ? 'See results' : 'Next'}
        </Button>
      </div>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
