import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radio } from '@components/foyer/Choice';
import { PillButton } from '@components/foyer/ui';
import { ScrollView, View } from '@components/RNCompat';
import type { MainStackParamList } from '@navigation/types';
import { castVote, closeVoteEarly, fetchVote } from '@services/votingService';
import { appColors, appTypography } from '@theme/index';
import {
  VOTING_COPY,
  VoteClientError,
  detailChips,
  isVoteOpen,
  optionShare,
  talliesVisible,
  voteRowSubline,
  voteTotal,
} from '@shared/voting';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'VotingDetail'>;

export const VoteBallotScreen = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<MainStackParamList, 'VotingDetail'>>();
  const { voteId } = route.params;
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const voteQuery = useQuery({
    queryKey: ['vote', String(voteId)],
    queryFn: () => fetchVote(voteId),
    retry: false,
  });
  const vote = voteQuery.data;
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['vote', String(voteId)] });
    await queryClient.invalidateQueries({ queryKey: ['votes'] });
  };
  const cast = useMutation({
    mutationFn: (optionId: string) => castVote(voteId, optionId),
    onSuccess: refresh,
    onError: (error) => setNotice(error instanceof VoteClientError ? error.message : VOTING_COPY.submitFailed),
  });
  const close = useMutation({
    mutationFn: () => closeVoteEarly(voteId),
    onSuccess: async () => {
      setConfirmClose(false);
      await refresh();
    },
    onError: (error) => setNotice(error instanceof VoteClientError ? error.message : VOTING_COPY.closeFailed),
  });

  const open = vote ? isVoteOpen(vote) : false;
  const showTallies = vote ? talliesVisible(vote) : false;
  const locked = Boolean(vote && (vote.hasVoted || !open));
  const selected = vote?.hasVoted && vote.myOptionId != null ? String(vote.myOptionId) : picked;
  const total = vote ? voteTotal(vote) : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={appColors.primary} />
          <Text style={styles.backText}>{VOTING_COPY.back}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {voteQuery.isError ? <Text style={styles.error}>{VOTING_COPY.loadFailed}</Text> : null}
        {vote ? (
          <>
            <View style={styles.chips}>
              {detailChips(vote).map((chip) => (
                <View key={chip} style={[styles.chip, chip === VOTING_COPY.chip ? styles.chipVoting : null]}>
                  <Text style={[styles.chipText, chip === VOTING_COPY.chip ? styles.chipVotingText : null]}>{chip}</Text>
                </View>
              ))}
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {vote.title}
            </Text>
            <Text style={styles.subline}>{voteRowSubline(vote)}</Text>
            {vote.description.trim() ? <Text style={styles.description}>{vote.description.trim()}</Text> : null}
            {!open ? <Text style={styles.banner}>{VOTING_COPY.closedBanner}</Text> : null}
            {vote.hasVoted ? <Text style={styles.submitted}>{VOTING_COPY.submitted}</Text> : null}
            <View style={styles.options}>
              {vote.options.map((option) => {
                const share = showTallies ? optionShare(option.count, total) : null;
                const chosen = selected != null && String(option.id) === String(selected);
                return (
                  <Pressable
                    key={String(option.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: chosen, disabled: locked }}
                    disabled={locked || cast.isPending}
                    onPress={() => {
                      setPicked(String(option.id));
                      setNotice(null);
                    }}
                    style={[styles.option, chosen ? styles.optionOn : null]}
                  >
                    <Radio selected={chosen} />
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    {showTallies && option.count != null ? (
                      <Text style={styles.count}>
                        {option.count}
                        {share != null ? ` · ${share}%` : ''}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {open && !showTallies ? <Text style={styles.helper}>{VOTING_COPY.resultsHidden}</Text> : null}
            {open && !vote.hasVoted ? (
              <>
                <PillButton
                  label={VOTING_COPY.submit}
                  onPress={() => {
                    if (selected == null) return;
                    setNotice(null);
                    cast.mutate(selected);
                  }}
                  disabled={selected == null}
                  loading={cast.isPending}
                  testID="vote-submit"
                  style={styles.submit}
                />
                <Text style={styles.helperCenter}>{VOTING_COPY.submitOnce}</Text>
              </>
            ) : null}
            {open && vote.canClose ? (
              <View style={styles.closeBlock}>
                {confirmClose ? (
                  <>
                    <Text style={styles.helperCenter}>{VOTING_COPY.closeConfirm}</Text>
                    <Pressable accessibilityRole="button" onPress={() => close.mutate()} disabled={close.isPending}>
                      <Text style={styles.close}>{VOTING_COPY.closeNow}</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => setConfirmClose(true)}>
                    <Text style={styles.close}>{VOTING_COPY.closeVote}</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
            {notice ? <Text style={styles.error}>{notice}</Text> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  backText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 17 },
  body: { padding: 20, paddingBottom: 40, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, backgroundColor: '#f3eeeb', paddingHorizontal: 12, paddingVertical: 4 },
  chipVoting: { backgroundColor: '#f9e8ee' },
  chipText: { fontFamily: appTypography.bodySemibold, fontSize: 14, color: appColors.ink },
  chipVotingText: { color: appColors.primary },
  title: { fontFamily: appTypography.heading, fontSize: 34, lineHeight: 40, color: appColors.ink, fontWeight: '700', marginTop: 8 },
  subline: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 15 },
  description: { marginTop: 8, color: appColors.ink, fontFamily: appTypography.bodyRegular, fontSize: 17, lineHeight: 26 },
  banner: { marginTop: 8, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  submitted: { marginTop: 8, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.primary },
  options: { gap: 8, marginTop: 8 },
  option: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionOn: { borderColor: appColors.primary, backgroundColor: '#f9e8ee' },
  optionLabel: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 17, color: appColors.ink },
  count: { fontFamily: appTypography.bodySemibold, fontSize: 14, color: appColors.mutedInk },
  helper: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20 },
  helperCenter: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  submit: { marginTop: 8 },
  closeBlock: { marginTop: 16, alignItems: 'center', gap: 8 },
  close: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  error: { color: appColors.danger, fontFamily: appTypography.bodyRegular, fontSize: 15, textAlign: 'center' },
});
