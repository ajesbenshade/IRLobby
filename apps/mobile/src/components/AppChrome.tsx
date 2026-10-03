import { useEffect, useRef, useState, type ComponentType, type MutableRefObject, type PropsWithChildren, type ReactNode } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAvoidingView, ScrollView, View } from '@components/RNCompat';
import { useSafeInsets } from '@hooks/useSafeInsets';
import { useTabScreenBottomPadding } from '@navigation/tabBarLayout';
import { appColors, appTypography, fontSize, radii, shadows, spacing } from '@theme/index';

const AnimatedView = Animated.View as unknown as ComponentType<any>;

type AppScrollViewProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactNode;
  /** Lets a screen scroll to a section (e.g. the host's "Who's coming" button). */
  scrollRef?: MutableRefObject<{ scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void } | null>;
  /**
   * Stack screens with `headerShown: false` and their own top row. iOS clears the status bar through
   * `contentInsetAdjustmentBehavior="automatic"`; Android is edge-to-edge and has no such inset, so the status-bar
   * height is added here. Tab screens are always headerless and need no flag.
   */
  headerless?: boolean;
}>;

type AppScreenContainerProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
};

type SectionIntroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

type PanelCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'accent' | 'warm' | 'dark';
}>;

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: 'primary' | 'secondary' | 'accent';
};

type EmptyStatePanelProps = {
  title: string;
  description: string;
  action?: ReactNode;
  animateOnMount?: boolean;
};

type AuthShellProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  subtitle: string;
  footer?: ReactNode;
}>;

type DetailRowProps = {
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
  danger?: boolean;
  /** Disabled control on the right: the labels fade to 50% with it. */
  dimmed?: boolean;
  onPress?: () => void;
};

export const AppScrollView = ({ children, contentContainerStyle, refreshControl, scrollRef, headerless = false }: AppScrollViewProps) => {
  // Only defined inside the tab navigator; stack screens pushed above the tabs have no bar to clear.
  const tabBottomPadding = useTabScreenBottomPadding();
  const insets = useSafeInsets();
  const statusBarClearance = Platform.OS === 'android' && (headerless || tabBottomPadding != null) ? insets.top : 0;

  return (
    <View style={[styles.screenRoot, statusBarClearance > 0 ? { paddingTop: statusBarClearance } : null]} testID="app-scroll-root">
      <ScrollView
        {...({ ref: scrollRef } as object)}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl as ScrollViewProps['refreshControl']}
        contentContainerStyle={[
          styles.scrollContent,
          tabBottomPadding != null ? { paddingBottom: tabBottomPadding } : null,
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
};

const useKeyboardVisible = (enabled: boolean) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled]);

  return visible;
};

export const AppScreenContainer = ({ children, style }: AppScreenContainerProps) => {
  // Fixed (non-scrolling) tab screens, e.g. an open chat thread, must also clear the floating tab bar.
  const tabBottomPadding = useTabScreenBottomPadding();
  const keyboardVisible = useKeyboardVisible(tabBottomPadding != null);
  const clearTabBar = tabBottomPadding != null && !keyboardVisible;

  return (
    <View style={styles.screenRoot}>
      <SafeAreaView
        style={[styles.screenContainer, style, clearTabBar ? { paddingBottom: tabBottomPadding } : null]}
        edges={clearTabBar ? ['top'] : ['top', 'bottom']}
      >
        {children}
      </SafeAreaView>
    </View>
  );
};

export const PageHeader = ({ eyebrow, title, subtitle, rightContent }: PageHeaderProps) => (
  <View style={styles.headerRow}>
    <View style={styles.headerTextBlock}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text variant="headlineMedium" style={styles.pageTitle}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodyMedium" style={styles.pageSubtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {rightContent ? <View style={styles.headerAction}>{rightContent}</View> : null}
  </View>
);

export const SectionIntro = ({ eyebrow, title, subtitle }: SectionIntroProps) => (
  <View style={styles.sectionIntro}>
    {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
    <Text variant="titleMedium" style={styles.sectionTitle}>
      {title}
    </Text>
    {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

export const DetailRow = ({
  title,
  subtitle,
  accessory,
  danger = false,
  dimmed = false,
  onPress,
}: DetailRowProps) => {
  const row = (
    <View style={[styles.detailRow, danger ? styles.detailRowDanger : null]}>
      <View style={[styles.detailTextBlock, dimmed ? { opacity: 0.5 } : null]}>
        <Text style={[styles.detailTitle, danger ? styles.detailTitleDanger : null]}>{title}</Text>
        {subtitle ? <Text style={styles.detailSubtitle}>{subtitle}</Text> : null}
      </View>
      {accessory ? <View style={styles.detailAccessory}>{accessory}</View> : null}
    </View>
  );

  if (!onPress) {
    return row;
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      {row}
    </Pressable>
  );
};

export const PanelCard = ({ children, style, tone = 'default' }: PanelCardProps) => (
  <Surface
    elevation={0}
    style={[
      styles.panelCard,
      tone === 'accent' ? styles.panelAccent : null,
      tone === 'warm' ? styles.panelWarm : null,
      tone === 'dark' ? styles.panelDark : null,
      style,
    ]}
  >
    {children}
  </Surface>
);

export const StatCard = ({ label, value, detail, tone = 'primary' }: StatCardProps) => (
  <PanelCard style={styles.statCard} tone={tone === 'secondary' ? 'warm' : tone === 'accent' ? 'accent' : 'default'}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statDetail}>{detail}</Text>
  </PanelCard>
);

export const AccentPill = ({
  children,
  tone = 'primary',
}: PropsWithChildren<{ tone?: 'primary' | 'secondary' | 'neutral' | 'gold' }>) => (
  <View
    style={[
      styles.pill,
      tone === 'secondary' ? styles.pillSecondary : null,
      tone === 'neutral' ? styles.pillNeutral : null,
      tone === 'gold' ? styles.pillGold : null,
    ]}
  >
    <Text
      maxFontSizeMultiplier={1.4}
      style={[
        styles.pillText,
        tone === 'neutral' ? styles.pillTextNeutral : null,
        tone === 'gold' ? styles.pillTextGold : null,
      ]}
    >
      {children}
    </Text>
  </View>
);

export const EmptyStatePanel = ({
  title,
  description,
  action,
  animateOnMount = true,
}: EmptyStatePanelProps) => {
  const fade = useRef(new Animated.Value(animateOnMount ? 0 : 1)).current;
  const lift = useRef(new Animated.Value(animateOnMount ? 14 : 0)).current;

  useEffect(() => {
    if (!animateOnMount) {
      return;
    }

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animateOnMount, fade, lift]);

  return (
    <AnimatedView style={{ opacity: fade, transform: [{ translateY: lift }] }}>
      <PanelCard style={styles.emptyCard}>
        <Text variant="titleMedium" style={styles.emptyTitle}>
          {title}
        </Text>
        <Text style={styles.emptyDescription}>{description}</Text>
        {action ? <View style={styles.emptyAction}>{action}</View> : null}
      </PanelCard>
    </AnimatedView>
  );
};

export const AuthShell = ({ eyebrow, title, subtitle, footer, children }: AuthShellProps) => (
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    style={styles.authRoot}
  >
    <View style={styles.screenRoot}>
      <DecorativeBackdrop />
      <SafeAreaView style={styles.authSafeArea} edges={[ 'top', 'bottom' ]}>
        <View style={styles.authCenterWrap}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text variant="headlineMedium" style={styles.authTitle}>
            {title}
          </Text>
          <Text style={styles.authSubtitle}>{subtitle}</Text>
          <View style={styles.authContent}>{children}</View>
          {footer ? <View style={styles.authFooter}>{footer}</View> : null}
        </View>
      </SafeAreaView>
    </View>
  </KeyboardAvoidingView>
);

const DecorativeBackdrop = () => (
  <>
    <View style={[styles.glowOrb, styles.glowOrbPrimary]} />
    <View style={[styles.glowOrb, styles.glowOrbWarm]} />
    <View style={[styles.glowOrb, styles.glowOrbSoft]} />
  </>
);

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.9,
  },
  glowOrbPrimary: {
    width: 280,
    height: 280,
    top: -90,
    right: -60,
    backgroundColor: 'rgba(162, 3, 63, 0.16)',
  },
  glowOrbWarm: {
    width: 200,
    height: 200,
    top: 180,
    left: -80,
    backgroundColor: 'rgba(249, 232, 238, 0.9)',
  },
  glowOrbSoft: {
    width: 240,
    height: 240,
    bottom: 80,
    right: -100,
    backgroundColor: 'rgba(249, 232, 238, 0.7)',
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextBlock: {
    // Wraps under the pill at the largest text sizes instead of squeezing the title.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 200,
    gap: spacing.sm,
  },
  eyebrow: {
    color: appColors.mutedInk,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontWeight: '600',
    fontSize: fontSize.screenTitle,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 22,
    fontSize: 15,
  },
  headerAction: {
    paddingTop: 10,
  },
  sectionIntro: {
    gap: 6,
  },
  sectionEyebrow: {
    color: appColors.softInk,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  sectionTitle: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontWeight: '600',
    fontSize: fontSize.cardTitle,
    // Paper's titleMedium variant ships a 24pt line height, which clips a 25pt serif.
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 21,
    fontSize: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: appColors.line,
  },
  detailRowDanger: {
    borderTopColor: 'rgba(244, 63, 94, 0.35)',
  },
  detailTextBlock: {
    flex: 1,
    gap: 4,
  },
  detailTitle: {
    color: appColors.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  detailTitleDanger: {
    color: appColors.danger,
  },
  detailSubtitle: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
  detailAccessory: {
    flexShrink: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  panelCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    backgroundColor: appColors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    ...shadows.card,
  },
  panelAccent: {
    backgroundColor: appColors.primarySoft,
    borderColor: 'rgba(162, 3, 63, 0.22)',
  },
  panelWarm: {
    backgroundColor: appColors.warnBg,
    borderColor: 'rgba(138, 84, 10, 0.22)',
  },
  panelDark: {
    backgroundColor: appColors.cardStrong,
    borderColor: appColors.darkLine,
  },
  statCard: {
    minHeight: 152,
    justifyContent: 'space-between',
  },
  statLabel: {
    color: appColors.mutedInk,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  statValue: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  statDetail: {
    color: appColors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: appColors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(162, 3, 63, 0.22)',
  },
  pillSecondary: {
    backgroundColor: appColors.primarySoft,
    borderColor: 'rgba(162, 3, 63, 0.22)',
  },
  pillNeutral: {
    backgroundColor: appColors.cardStrong,
    borderColor: appColors.line,
  },
  pillText: {
    color: appColors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pillGold: {
    backgroundColor: 'rgba(232, 200, 114, 0.14)',
    borderColor: 'rgba(232, 200, 114, 0.4)',
  },
  pillTextNeutral: {
    color: appColors.mutedInk,
  },
  pillTextGold: {
    color: appColors.accent,
  },
  emptyCard: {
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  emptyTitle: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  emptyDescription: {
    color: appColors.mutedInk,
    lineHeight: 22,
    fontSize: 15,
  },
  emptyAction: {
    marginTop: spacing.xs,
  },
  authRoot: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  authSafeArea: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  authCenterWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  authTitle: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontWeight: '600',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    marginTop: spacing.xs,
  },
  authSubtitle: {
    color: appColors.mutedInk,
    marginTop: spacing.sm,
    lineHeight: 22,
    fontSize: 15,
  },
  authContent: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  authFooter: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
