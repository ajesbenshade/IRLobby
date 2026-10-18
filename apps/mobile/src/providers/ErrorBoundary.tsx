import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text, View } from '@components/RNCompat';
import { appColors, appTypography, palette, radii, spacing } from '@theme/index';

import { isFoyerMode } from '@constants/appMode';
import { SUPPORT_COPY } from '@constants/foyerCopy';

import { captureException } from '../lib/monitoring';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

const FALLBACK_GRADIENT: readonly [string, string, string] = [
  palette.primary,
  palette.primaryDeep,
  palette.accent,
];

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureException(error, { componentStack: errorInfo.componentStack ?? undefined });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    if (isFoyerMode()) {
      // Frame 252: plain copy only. No raw error text and no claim that anyone was notified
      // (only true when the Sentry DSN is set). captureException still runs in componentDidCatch.
      return (
        <View style={styles.foyerRoot} testID="crash-screen">
          <View style={styles.foyerIcon}>
            <Text style={styles.foyerIconText}>!</Text>
          </View>
          <Text accessibilityRole="header" style={styles.foyerTitle}>
            {SUPPORT_COPY.crashTitle}
          </Text>
          <Text style={styles.foyerBody}>{SUPPORT_COPY.crashBody}</Text>
          <Pressable
            onPress={this.handleReset}
            accessibilityRole="button"
            accessibilityLabel={SUPPORT_COPY.crashRetry}
            style={styles.foyerButton}
            testID="crash-try-again"
          >
            <Text style={styles.foyerButtonLabel}>{SUPPORT_COPY.crashRetry}</Text>
          </Pressable>
        </View>
      );
    }
    const message = this.state.error?.message ?? 'Something went wrong.';
    return (
      <LinearGradient colors={FALLBACK_GRADIENT} style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>Hiccup detected</Text>
          <Text style={styles.body}>
            We hit an unexpected error. The team has been notified.
          </Text>
          <Text style={styles.detail} numberOfLines={3}>
            {message}
          </Text>
          <Pressable
            onPress={this.handleReset}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={styles.button}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }
}

const styles = StyleSheet.create({
  foyerRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: appColors.background,
  },
  foyerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primarySoft,
    marginBottom: 8,
  },
  foyerIconText: { fontSize: 36, lineHeight: 42, fontWeight: '800', color: appColors.primary },
  foyerTitle: { fontFamily: appTypography.heading, fontSize: 26, lineHeight: 34, color: appColors.ink, textAlign: 'center' },
  foyerBody: {
    fontFamily: appTypography.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    color: appColors.mutedInk,
    textAlign: 'center',
  },
  foyerButton: {
    alignSelf: 'stretch',
    minHeight: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primary,
    marginTop: 16,
  },
  foyerButtonLabel: { fontFamily: appTypography.bodySemibold, fontSize: 17, color: '#ffffff' },
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: appColors.card,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: appColors.ink,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: appColors.mutedInk,
    textAlign: 'center',
    lineHeight: 22,
  },
  detail: {
    fontSize: 12,
    color: appColors.softInk,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: '#a2033f',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonLabel: {
    color: appColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
