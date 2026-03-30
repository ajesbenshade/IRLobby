import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors, radii, shadows, spacing } from '@theme/index';

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
    <DecorativeBackdrop />
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
    <DecorativeBackdrop />
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

export const AccentPill = ({ children, tone = 'primary' }: PropsWithChildren<{ tone?: 'primary' | 'secondary' | 'neutral' }>) => (
  <View
    style={[
      styles.pill,
      tone === 'secondary' ? styles.pillSecondary : null,
      tone === 'neutral' ? styles.pillNeutral : null,
    ]}
  >
    <Text style={[styles.pillText, tone === 'neutral' ? styles.pillTextNeutral : null]}>{children}</Text>
  </View>
);

export const EmptyStatePanel = ({ title, description, action }: EmptyStatePanelProps) => (
  <PanelCard style={styles.emptyCard}>
    <AccentPill tone="neutral">Nothing here yet</AccentPill>
    <Text variant="titleMedium" style={styles.emptyTitle}>
      {title}
    </Text>
    <Text style={styles.emptyDescription}>{description}</Text>
    {action ? <View style={styles.emptyAction}>{action}</View> : null}
  </PanelCard>
);

export const AuthShell = ({ eyebrow, title, subtitle, footer, children }: AuthShellProps) => (
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    style={styles.authRoot}
  >
    <View style={styles.screenRoot}>
      <DecorativeBackdrop />
      <SafeAreaView style={styles.authSafeArea} edges={[ 'top', 'bottom' ]}>
        <View style={styles.authCenterWrap}>
          <PanelCard style={styles.authCard} tone="default">
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text variant="headlineMedium" style={styles.authTitle}>
              {title}
            </Text>
            <Text style={styles.authSubtitle}>{subtitle}</Text>
            <View style={styles.authContent}>{children}</View>
            {footer ? <View style={styles.authFooter}>{footer}</View> : null}
          </PanelCard>
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
    gap: spacing.md,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.8,
  },
  glowOrbPrimary: {
    width: 220,
    height: 220,
    top: -60,
    right: -40,
    backgroundColor: '#dfe3ff',
  },
  glowOrbWarm: {
    width: 140,
    height: 140,
    top: 180,
    left: -50,
    backgroundColor: '#ffefcc',
  },
  glowOrbSoft: {
    width: 180,
    height: 180,
    bottom: 120,
    right: -70,
    backgroundColor: '#d8f5ea',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: appColors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: appColors.ink,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  pageSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 22,
  },
  headerAction: {
    paddingTop: 6,
  },
  sectionIntro: {
    gap: 4,
  },
  sectionEyebrow: {
    color: appColors.softInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.line,
  },
  detailRowDanger: {
    borderTopColor: '#f4c5cc',
  },
  detailTextBlock: {
    flex: 1,
    gap: 4,
  },
  detailTitle: {
    color: appColors.ink,
    fontSize: 15,
    fontWeight: '700',
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
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: appColors.card,
    borderWidth: 1,
    borderColor: '#eff3fa',
    ...shadows.card,
  },
  panelAccent: {
    backgroundColor: '#f4fbf7',
  },
  panelWarm: {
    backgroundColor: '#fff8eb',
  },
  panelDark: {
    backgroundColor: appColors.ink,
    borderColor: '#24304d',
  },
  statCard: {
    minHeight: 144,
    justifyContent: 'space-between',
  },
  statLabel: {
    color: appColors.mutedInk,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statValue: {
    color: appColors.ink,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  statDetail: {
    color: appColors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: '#e8ebff',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillSecondary: {
    backgroundColor: '#fff0cf',
  },
  pillNeutral: {
    backgroundColor: '#edf2f8',
  },
  pillText: {
    color: appColors.primaryDeep,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pillTextNeutral: {
    color: appColors.mutedInk,
  },
  emptyCard: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  emptyDescription: {
    color: appColors.mutedInk,
    lineHeight: 22,
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
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  authCard: {
    maxWidth: 460,
    alignSelf: 'center',
    width: '100%',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  authTitle: {
    color: appColors.ink,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: spacing.xs,
  },
  authSubtitle: {
    color: appColors.mutedInk,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  authContent: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  authFooter: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
