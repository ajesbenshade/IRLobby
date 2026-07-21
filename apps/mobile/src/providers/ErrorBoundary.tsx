import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text, View } from '@components/RNCompat';
import { appColors, palette, radii, spacing } from '@theme/index';

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
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }
}

const styles = StyleSheet.create({
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
    fontFamily: 'Outfit_400Regular',
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: appColors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: appColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
