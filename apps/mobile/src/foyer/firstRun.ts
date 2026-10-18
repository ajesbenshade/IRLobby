import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ROUTES } from '@shared/schema';

import { isFoyerMode } from '@constants/appMode';
import { api } from '@services/apiClient';
import { updateOnboarding, type OnboardingPayload } from '@services/authService';
import type { AuthUser } from '../types/auth';

type FirstRunUser = Pick<AuthUser, 'onboardingCompleted' | 'activityPreferences'> | null | undefined;

/**
 * The legacy IRLobby onboarding (location, vibe quiz, matches copy) only runs in irlobby mode.
 * The server marks every new account `onboardingCompleted: false`, so Foyer mode must ignore it.
 */
export const showsLegacyOnboarding = (user: FirstRunUser, foyer = isFoyerMode()): boolean =>
  !foyer && user?.onboardingCompleted === false;

/*
 * Set once the member leaves the church step this session, so a failed onboarding PATCH (old server, network)
 * can never trap them on it. The step comes back next launch until the server records it.
 */
let churchStepDone = false;
const churchStepListeners = new Set<() => void>();
export const markChurchStepDone = () => {
  churchStepDone = true;
  churchStepListeners.forEach((listener) => listener());
};
/** Re-renders the caller (the root navigator) when the church step is left, even if the profile refresh fails. */
export const useChurchStepDone = (): boolean =>
  useSyncExternalStore(
    (listener) => {
      churchStepListeners.add(listener);
      return () => churchStepListeners.delete(listener);
    },
    () => churchStepDone,
  );
/** Test helper. */
export const resetFirstRunState = () => {
  churchStepDone = false;
  churchStepListeners.clear();
  welcomeActive = false;
};

/** Foyer first run: the church step (`Which church do you attend?`) instead of the legacy onboarding. */
export const needsFoyerChurchStep = (user: FirstRunUser, foyer = isFoyerMode()): boolean =>
  foyer && user?.onboardingCompleted === false && !churchStepDone;

/**
 * Marks onboarding done on the server without the vibe quiz. The server requires preferences (or a
 * skipped quiz) to finish, so this records `vibeQuizSkipped`. Terms/Privacy were accepted at sign-up.
 */
export const foyerOnboardingPayload = (user: FirstRunUser): OnboardingPayload => {
  const prefs = (user?.activityPreferences ?? {}) as Record<string, unknown>;
  const vibe = prefs.vibe && typeof prefs.vibe === 'object' ? (prefs.vibe as Record<string, unknown>) : {};
  return {
    onboarding_completed: true,
    activity_preferences: { ...prefs, vibe: { ...vibe, vibeQuizSkipped: true } },
  };
};

export const completeFoyerOnboarding = (user: FirstRunUser) => updateOnboarding(foyerOnboardingPayload(user));

/** Saves the member's church the same way Profile does (`PATCH /api/users/profile/ {church_id}`). */
export const saveChurchChoice = async (churchId: number): Promise<void> => {
  await api.patch(API_ROUTES.USER_PROFILE, { church_id: churchId });
};

/*
 * After the church step the app opens once on Profile, with a welcome note, so the member can add the
 * basics (name, city, photo). In-memory only: a relaunch goes to Discover as usual.
 */
let welcomeActive = false;
export const startFoyerWelcome = () => {
  welcomeActive = true;
};
export const isFoyerWelcomeActive = () => welcomeActive;
export const endFoyerWelcome = () => {
  welcomeActive = false;
};

/** `Pick your church` card: once `Not now` is tapped on Discover it only shows on Profile (stored on device). */
export const PICK_CHURCH_DISMISSED_KEY = 'foyer.pickChurchCard.dismissed';

export const loadPickChurchDismissed = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(PICK_CHURCH_DISMISSED_KEY)) === 'true';
  } catch {
    return false;
  }
};

export const savePickChurchDismissed = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(PICK_CHURCH_DISMISSED_KEY, 'true');
  } catch {
    // Best effort: the card shows again next launch.
  }
};

export type PickChurchSurface = 'discover' | 'profile';

/** Foyer members with no church see the card on Discover until they dismiss it, and always on Profile. */
export const showsPickChurchCard = (
  options: { churchId?: number | null; surface: PickChurchSurface; dismissed: boolean; hiddenThisVisit?: boolean },
  foyer = isFoyerMode(),
): boolean => {
  if (!foyer || options.churchId != null || options.hiddenThisVisit) {
    return false;
  }
  return options.surface === 'profile' || !options.dismissed;
};
