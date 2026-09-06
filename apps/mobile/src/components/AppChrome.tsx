import { useEffect, useRef, type ComponentType, type PropsWithChildren, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAvoidingView, ScrollView, View } from '@components/RNCompat';
import { appColors, appTypography, radii, shadows, spacing } from '@theme/index';

const AnimatedView = Animated.View as unknown as ComponentType<any>;

type AppScrollViewProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactNode;
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
};

export const AppScrollView = ({ children, contentContainerStyle, refreshControl }: AppScrollViewProps) => (
  <View style={styles.screenRoot}>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl as ScrollViewProps['refreshControl']}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  </View>
);

export const AppScreenContainer = ({ children, style }: AppScreenContainerProps) => (
  <View style={styles.screenRoot}>
    <SafeAreaView style={[styles.screenContainer, style]} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  </View>
);

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

export const DetailRow = ({ title, subtitle, accessory, danger = false }: DetailRowProps) => (
  <View style={[styles.detailRow, danger ? styles.detailRowDanger : null]}>
    <View style={styles.detailTextBlock}>
      <Text style={[styles.detailTitle, danger ? styles.detailTitleDanger : null]}>{title}</Text>
      {subtitle ? <Text style={styles.detailSubtitle}>{subtitle}</Text> : null}
    </View>
    {accessory ? <View style={styles.detailAccessory}>{accessory}</View> : null}
  </View>
);

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
    backgroundColor: 'rgba(255, 107, 74, 0.22)',
  },
  glowOrbWarm: {
    width: 200,
    height: 200,
    top: 180,
    left: -80,
    backgroundColor: 'rgba(255, 139, 112, 0.16)',
  },
  glowOrbSoft: {
    width: 240,
    height: 240,
    bottom: 80,
    right: -100,
    backgroundColor: 'rgba(255, 227, 218, 0.55)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextBlock: {
    flex: 1,
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
    fontSize: 28,
    lineHeight: 34,
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
    fontSize: 20,
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
    backgroundColor: 'rgba(255, 107, 74, 0.12)',
    borderColor: 'rgba(255, 107, 74, 0.28)',
  },
  panelWarm: {
    backgroundColor: 'rgba(232, 200, 114, 0.1)',
    borderColor: 'rgba(232, 200, 114, 0.28)',
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
    backgroundColor: 'rgba(255, 107, 74, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 107, 74, 0.28)',
  },
  pillSecondary: {
    backgroundColor: 'rgba(255, 227, 218, 0.9)',
    borderColor: 'rgba(255, 107, 74, 0.28)',
  },
  pillNeutral: {
    backgroundColor: appColors.cardStrong,
    borderColor: appColors.line,
  },
  pillText: {
    color: appColors.primaryGlow,
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
