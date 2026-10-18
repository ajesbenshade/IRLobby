import { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChurchPicker } from '@components/foyer/ChurchPicker';
import { InlineError, PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { CHURCH_STEP_COPY } from '@constants/foyerCopy';
import { completeFoyerOnboarding, markChurchStepDone, saveChurchChoice, startFoyerWelcome } from '@foyer/firstRun';
import { useAuth } from '@hooks/useAuth';
import type { ChurchRecord } from '@services/foyerService';
import { appColors, appTypography } from '@theme/index';

/**
 * Foyer first run (replaces the legacy IRLobby onboarding and vibe quiz). Pick a church or skip; either way
 * onboarding is marked done and the app opens on Profile for the basics.
 */
export const FoyerChurchStepScreen = () => {
  const { user, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<ChurchRecord | null>(null);
  const [pending, setPending] = useState<'continue' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finish = async (mode: 'continue' | 'skip') => {
    if (pending || (mode === 'continue' && !selected)) {
      return;
    }
    setPending(mode);
    setError(null);
    if (mode === 'continue' && selected) {
      try {
        await saveChurchChoice(selected.id);
      } catch {
        setError(CHURCH_STEP_COPY.saveFailed);
        setPending(null);
        return;
      }
    }
    try {
      await completeFoyerOnboarding(user);
    } catch {
      // Best effort: the member still gets in; the step returns next launch until the server records it.
    }
    markChurchStepDone();
    startFoyerWelcome();
    try {
      // The new profile re-renders the navigator, which now shows Main (opening on Profile).
      await refreshProfile();
    } catch {
      setPending(null);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="church-step">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>
          {CHURCH_STEP_COPY.title}
        </Text>
        <Text style={styles.copy}>{CHURCH_STEP_COPY.body}</Text>
        <ChurchPicker
          selected={selected}
          onSelect={(church) => {
            setSelected(church);
            setError(null);
          }}
        />
        <InlineError message={error} />
      </ScrollView>
      <View style={styles.footer}>
        <PillButton
          label={CHURCH_STEP_COPY.continue}
          disabled={!selected || pending === 'skip'}
          loading={pending === 'continue'}
          onPress={() => void finish('continue')}
          testID="church-step-continue"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CHURCH_STEP_COPY.skip}
          disabled={pending != null}
          onPress={() => void finish('skip')}
          style={styles.skip}
          testID="church-step-skip"
        >
          <Text style={styles.skipText}>{CHURCH_STEP_COPY.skip}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: appColors.background, paddingHorizontal: 24 },
  body: { paddingTop: 32, paddingBottom: 16, gap: 14 },
  title: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 36, color: appColors.ink },
  copy: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.mutedInk },
  // Frame 242: sticky white footer with a hairline above it; the list scrolls underneath.
  footer: {
    gap: 6,
    paddingBottom: 12,
    paddingTop: 12,
    marginHorizontal: -24,
    paddingHorizontal: 16,
    backgroundColor: appColors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.line,
  },
  skip: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.primary },
});
