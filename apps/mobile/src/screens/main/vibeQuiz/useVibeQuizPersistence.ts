import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { VibeAnswers, VibeQuizResult } from '@shared/schema';

const STORAGE_KEY = 'vibe_quiz_progress_v1';
const RESULT_STORAGE_KEY = 'vibe_quiz_result_v1';
const SAVE_DEBOUNCE_MS = 250;

export type VibeQuizPersistedState = {
  phase: 'intro' | 'question' | 'results';
  currentIndex: number;
  answers: VibeAnswers;
  savedAt: number;
};

export type LoadedProgress = {
  status: 'idle' | 'loaded' | 'empty';
  state: VibeQuizPersistedState | null;
};

export function useVibeQuizPersistence() {
  const [loaded, setLoaded] = useState<LoadedProgress>({ status: 'idle', state: null });
  const latestRef = useRef<Omit<VibeQuizPersistedState, 'savedAt'> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (!raw) {
          setLoaded({ status: 'empty', state: null });
          return;
        }
        const parsed = JSON.parse(raw) as VibeQuizPersistedState;
        setLoaded({ status: 'loaded', state: parsed });
      } catch {
        if (!cancelled) setLoaded({ status: 'empty', state: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Single stable writer: drains whatever is in `latestRef` at fire time, so
  // multiple `saveProgress` calls inside the debounce window collapse into one
  // AsyncStorage write regardless of render frequency.
  const flush = useCallback(() => {
    timerRef.current = null;
    const snapshot = latestRef.current;
    if (!snapshot) return;
    const payload: VibeQuizPersistedState = { ...snapshot, savedAt: Date.now() };
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      /* non-fatal */
    });
  }, []);

  const saveProgress = useCallback(
    (state: Omit<VibeQuizPersistedState, 'savedAt'>) => {
      latestRef.current = state;
      if (timerRef.current) return; // already scheduled — coalesce
      timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  const clearProgress = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    latestRef.current = null;
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Persist the final scored quiz result so the standalone results screen can
   * recover it on cold start (e.g. when launched offline via deep link).
   */
  const saveResult = useCallback(async (result: VibeQuizResult) => {
    try {
      await AsyncStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(result));
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadResult = useCallback(async (): Promise<VibeQuizResult | null> => {
    try {
      const raw = await AsyncStorage.getItem(RESULT_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as VibeQuizResult;
    } catch {
      return null;
    }
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  return { loaded, saveProgress, clearProgress, saveResult, loadResult };
}
