import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@components/foyer/ConfirmSheet';
import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { PillButton } from '@components/foyer/ui';
import { ScrollView, View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import {
  CIRCLE_COPY,
  CIRCLE_REPORT_REASONS,
  CircleClientError,
  circleDetailActions,
  inviteLine,
  leaveConfirmCopy,
  memberCountLabel,
  sameId,
  type CircleReportReason,
} from '@shared/circles';
import type { MainStackParamList } from '@navigation/types';
import {
  acceptCircleInvite,
  declineCircleInvite,
  fetchCircle,
  fetchInviteInbox,
  leaveCircle,
  reportCircle,
  requestToJoinCircle,
} from '@services/circleService';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'CircleDetail'>;

export const CircleDetailScreen = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<MainStackParamList, 'CircleDetail'>>();
  const { circleId, showInvite } = route.params;
  const queryClient = useQueryClient();
  useEffect(() => {
    if (String(circleId) === 'new') navigation.replace('CircleCreate');
  }, [circleId, navigation]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(showInvite === true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<CircleReportReason>('other');
  const [notice, setNotice] = useState<string | null>(null);

  const circleQuery = useQuery({
    queryKey: ['circle', String(circleId)],
    queryFn: () => fetchCircle(circleId),
    enabled: String(circleId) !== 'new',
    retry: false,
  });
  const circle = circleQuery.data;
  const invited = circle?.membershipState === 'invited';
  const inbox = useQuery({
    queryKey: ['circle-invites'],
    queryFn: fetchInviteInbox,
    enabled: invited,
    retry: false,
  });
  const invite = (inbox.data ?? []).find((row) => sameId(row.circleId, circleId));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['circle', String(circleId)] });
    await queryClient.invalidateQueries({ queryKey: ['circles'] });
    await queryClient.invalidateQueries({ queryKey: ['circle-invites'] });
    await queryClient.invalidateQueries({ queryKey: ['prayer-circles'] });
  };

  const fail = (error: unknown) => setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.saveFailed);

  const requestJoin = useMutation({ mutationFn: () => requestToJoinCircle(circleId), onSuccess: refresh, onError: fail });
  const leave = useMutation({
    mutationFn: () => leaveCircle(circleId),
    onSuccess: async () => {
      setLeaveOpen(false);
      await refresh();
    },
    onError: fail,
  });
  const accept = useMutation({
    mutationFn: () => (invite ? acceptCircleInvite(invite.id) : Promise.resolve()),
    onSuccess: refresh,
    onError: fail,
  });
  const decline = useMutation({
    mutationFn: () => (invite ? declineCircleInvite(invite.id) : Promise.resolve()),
    onSuccess: refresh,
    onError: fail,
  });
  const report = useMutation({
    mutationFn: () => reportCircle(circleId, reason),
    onSuccess: () => {
      setReportOpen(false);
      setNotice(CIRCLE_COPY.reportSent);
    },
    onError: (error) => setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.reportFailed),
  });

  const actions = circle ? circleDetailActions(circle) : [];
  const dismissInvite = () => {
    setInviteOpen(false);
    navigation.setParams({ showInvite: false });
  };
  const openInvite = () => navigation.navigate('CircleInvite', { circleId, name: circle?.name });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel={CIRCLE_COPY.back} onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={appColors.primary} />
          <Text style={styles.backText}>{CIRCLE_COPY.back}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {circleQuery.isError ? <Text style={styles.error}>{CIRCLE_COPY.loadFailed}</Text> : null}
        {circle ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              {circle.name}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{memberCountLabel(circle.memberCount)}</Text>
              {actions.includes('manage') ? (
                <Pressable accessibilityRole="button" onPress={() => navigation.navigate('CircleManage', { circleId, name: circle.name })}>
                  <Text style={styles.manage}>{CIRCLE_COPY.manage}</Text>
                </Pressable>
              ) : null}
            </View>
            {circle.description ? <Text style={styles.description}>{circle.description}</Text> : null}
            {circle.membersPreview.length > 0 ? (
              <View style={styles.preview}>
                <Text style={styles.section}>{CIRCLE_COPY.members}</Text>
                {circle.membersPreview.map((person) => (
                  <Text key={String(person.id)} style={styles.person}>
                    {person.name}
                    {person.isAdmin ? ' · Admin' : ''}
                  </Text>
                ))}
              </View>
            ) : null}
            {notice ? <Text style={styles.error}>{notice}</Text> : null}
            {invite ? <Text style={styles.description}>{inviteLine(invite.inviter?.name ?? '', circle.name)}</Text> : null}
            <View style={styles.actions}>
              {actions.includes('request') ? (
                <PillButton label={CIRCLE_COPY.requestCta} loading={requestJoin.isPending} onPress={() => requestJoin.mutate()} />
              ) : null}
              {actions.includes('pending') ? <PillButton label={CIRCLE_COPY.pending} disabled onPress={() => undefined} /> : null}
              {actions.includes('accept') && invite ? (
                <>
                  <PillButton label={CIRCLE_COPY.accept} loading={accept.isPending} onPress={() => accept.mutate()} />
                  <PillButton label={CIRCLE_COPY.decline} variant="outline" loading={decline.isPending} onPress={() => decline.mutate()} />
                </>
              ) : null}
              {actions.includes('accept') && !invite && inbox.isFetched ? (
                <Text style={styles.description}>{CIRCLE_COPY.alreadyInvited}</Text>
              ) : null}
              {actions.includes('leave') ? (
                <PillButton label={CIRCLE_COPY.leave} variant="destructiveOutline" onPress={() => setLeaveOpen(true)} />
              ) : null}
              {actions.includes('invite') ? <PillButton label={CIRCLE_COPY.inviteCta} onPress={openInvite} /> : null}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setReportOpen(true)} style={styles.report}>
              <Text style={styles.reportText}>{CIRCLE_COPY.report}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
      <FoyerSheet visible={inviteOpen} onDismiss={dismissInvite}>
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          {CIRCLE_COPY.inviteCta}
        </Text>
        <View style={styles.sheetActions}>
          <PillButton
            label={CIRCLE_COPY.inviteCta}
            onPress={() => {
              dismissInvite();
              openInvite();
            }}
          />
          <PillButton label={CIRCLE_COPY.skip} variant="outline" onPress={dismissInvite} />
        </View>
      </FoyerSheet>
      <ConfirmSheet
        visible={leaveOpen}
        title={CIRCLE_COPY.leave}
        body={leaveConfirmCopy(circle?.name ?? '')}
        confirmLabel={CIRCLE_COPY.leave}
        cancelLabel={CIRCLE_COPY.cancel}
        confirmVariant="destructive"
        pending={leave.isPending}
        error={leave.isError && leave.error instanceof CircleClientError ? leave.error.message : null}
        onConfirm={() => leave.mutate()}
        onCancel={() => setLeaveOpen(false)}
      />
      <FoyerSheet visible={reportOpen} onDismiss={() => setReportOpen(false)}>
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          {CIRCLE_COPY.report}
        </Text>
        {CIRCLE_REPORT_REASONS.map((option) => {
          const selected = reason === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setReason(option.value)}
              style={styles.reason}
            >
              <Text style={styles.person}>{selected ? '● ' : '○ '}{option.label}</Text>
            </Pressable>
          );
        })}
        <PillButton label={CIRCLE_COPY.report} loading={report.isPending} onPress={() => report.mutate()} />
      </FoyerSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { paddingHorizontal: 8, minHeight: 48, justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 4 },
  backText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 17 },
  body: { padding: 20, gap: 12, paddingBottom: 48 },
  title: { fontFamily: appTypography.heading, fontSize: 32, lineHeight: 38, color: appColors.ink, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  meta: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 16 },
  manage: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  description: { color: appColors.ink, fontFamily: appTypography.bodyRegular, fontSize: 16, lineHeight: 22 },
  preview: { gap: 6, marginTop: 8 },
  section: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  person: { fontFamily: appTypography.bodyRegular, fontSize: 16, lineHeight: 24, color: appColors.ink },
  actions: { gap: 10, marginTop: 12 },
  report: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  reportText: { color: appColors.mutedInk, fontFamily: appTypography.bodySemibold, fontSize: 15 },
  error: { color: appColors.danger, fontFamily: appTypography.bodyRegular, fontSize: 15 },
  sheetTitle: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 34, color: appColors.ink, marginBottom: 12 },
  sheetActions: { gap: 10 },
  reason: { minHeight: 44, justifyContent: 'center' },
});
