import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScrollView, View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { GET_PAID_COPY, STRIPE_CONNECT_CHIP } from '@constants/tickets';
import { useAuth } from '@hooks/useAuth';
import {
  fetchStripeConnectStatus,
  openStripeConnectOnboarding,
  stripeConnectChipLabel,
  stripeConnectStatusCopy,
} from '@services/paymentService';
import { appColors, appTypography, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';

export const GetPaidScreen = () => {
  const navigation = useNavigation();
  const { user, refreshProfile } = useAuth();

  const statusQuery = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: fetchStripeConnectStatus,
  });

  const chip = stripeConnectChipLabel(statusQuery.data, Boolean(user?.canSellTickets));
  const copy = stripeConnectStatusCopy(chip);
  const ready = chip === STRIPE_CONNECT_CHIP.ready;

  const onboardMutation = useMutation({
    mutationFn: openStripeConnectOnboarding,
    onSuccess: async () => {
      await statusQuery.refetch();
      await refreshProfile();
    },
  });

  const refetchStatus = statusQuery.refetch;

  useFocusEffect(
    useCallback(() => {
      void refetchStatus();
    }, [refetchStatus]),
  );

  const close = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    }
  };

  const primaryLabel = ready ? GET_PAID_COPY.refreshCta : GET_PAID_COPY.continueCta;
  const secondaryLabel = ready ? GET_PAID_COPY.doneCta : GET_PAID_COPY.notNowCta;

  const handlePrimary = () => {
    if (ready) {
      void statusQuery.refetch();
      void refreshProfile();
      return;
    }
    onboardMutation.mutate();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.card}>
          <View style={styles.navRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={close} style={styles.iconBtn}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={appColors.ink} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.iconBtn}>
              <MaterialCommunityIcons name="close" size={22} color={appColors.ink} />
            </Pressable>
          </View>

          {/* Title/status scroll; actions stay pinned. A flex:1 card + marginTop:'auto'
              footer previously pushed Continue off-screen on real iPhone heights. */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            testID="get-paid-scroll"
          >
            <Text style={styles.title}>{GET_PAID_COPY.screenTitle}</Text>
            <Text style={styles.subtitle}>{GET_PAID_COPY.screenSubtitle}</Text>
            <Text style={styles.fee}>{GET_PAID_COPY.feeCopy}</Text>

            <View style={styles.statusCard}>
              <View style={styles.statusIcon}>
                <MaterialCommunityIcons
                  name={ready ? 'check-decagram' : 'link-variant'}
                  size={28}
                  color={appColors.primary}
                />
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>{copy.title}</Text>
                <Text style={styles.statusBody}>{copy.body}</Text>
              </View>
            </View>

            {statusQuery.error ? (
              <HelperText type="error" visible>
                {getErrorMessage(statusQuery.error, 'Unable to load payout status.')}
              </HelperText>
            ) : null}
            {onboardMutation.error ? (
              <HelperText type="error" visible>
                {getErrorMessage(onboardMutation.error, 'Unable to open Stripe onboarding.')}
              </HelperText>
            ) : null}
          </ScrollView>

          <View style={styles.actions} testID="get-paid-actions">
            <AppButton
              onPress={handlePrimary}
              loading={onboardMutation.isPending}
              accessibilityLabel={primaryLabel}
              style={styles.primary}
            >
              {primaryLabel}
            </AppButton>
            {!ready ? <Text style={styles.leaveHelper}>{GET_PAID_COPY.leaveAppHelper}</Text> : null}

            <AppButton variant="ghost" onPress={close} style={styles.secondary}>
              {secondaryLabel}
            </AppButton>

            <Text style={styles.footer}>{GET_PAID_COPY.footer}</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: appColors.primarySoft,
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  card: {
    flex: 1,
    marginTop: spacing.sm,
    borderRadius: 28,
    backgroundColor: appColors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  actions: {
    flexShrink: 0,
    gap: 12,
    paddingTop: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: appColors.ink,
    fontFamily: appTypography.headingDisplay,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: appColors.mutedInk,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  fee: {
    color: appColors.mutedInk,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    padding: 16,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primarySoft,
  },
  statusCopy: {
    flex: 1,
    gap: 4,
  },
  statusTitle: {
    color: appColors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  statusBody: {
    color: appColors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
  },
  primary: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 52,
    borderRadius: radii.pill,
  },
  leaveHelper: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  secondary: {
    borderRadius: radii.pill,
  },
  footer: {
    color: appColors.softInk,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
