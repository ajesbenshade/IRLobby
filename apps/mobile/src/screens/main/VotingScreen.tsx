import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppScrollView } from '@components/AppChrome';
import { RefreshControl, View } from '@components/RNCompat';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList, MainTabParamList } from '@navigation/types';
import { fetchVoteCircles, fetchVotes } from '@services/votingService';
import { appColors, appTypography } from '@theme/index';
import { VOTING_COPY, audienceChip, canCreateVote, sectionVotes, voteRowSubline, type Vote } from '@shared/voting';

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Voting'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export const VotingScreen = () => {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const list = useQuery({
    queryKey: ['votes'],
    queryFn: () => fetchVotes(),
    retry: false,
  });
  const circles = useQuery({
    queryKey: ['vote-circles'],
    queryFn: () => fetchVoteCircles(),
    retry: false,
  });
  const votes = list.data?.votes ?? [];
  const sections = sectionVotes(votes);
  const canCreate = canCreateVote({
    isChurchAdmin: Boolean(user?.isChurchAdmin),
    circles: circles.data?.circles ?? [],
  });
  const empty = !list.isLoading && !list.isError && votes.length === 0;

  return (
    <AppScrollView
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {VOTING_COPY.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={VOTING_COPY.newVote}
          onPress={() => navigation.navigate('VotingCreate')}
          style={styles.plus}
          testID="voting-create"
        >
          <MaterialCommunityIcons name="plus" size={26} color={appColors.white} />
        </Pressable>
      </View>
      {list.isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={index} style={styles.skeleton} />
          ))}
        </View>
      ) : null}
      {list.isError ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{VOTING_COPY.loadFailed}</Text>
          <Pressable accessibilityRole="button" onPress={() => void list.refetch()}>
            <Text style={styles.retry}>{VOTING_COPY.tryAgain}</Text>
          </Pressable>
        </View>
      ) : null}
      {empty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{VOTING_COPY.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{VOTING_COPY.emptyBody}</Text>
          {canCreate ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('VotingCreate')}
              style={styles.emptyCta}
            >
              <Text style={styles.emptyCtaText}>{VOTING_COPY.newVote}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!list.isLoading && !list.isError && votes.length > 0 ? (
        <View style={styles.sections}>
          <VoteSection
            label={VOTING_COPY.openSection}
            votes={sections.open}
            onOpen={(id) => navigation.navigate('VotingDetail', { voteId: id })}
          />
          <VoteSection
            label={VOTING_COPY.closedSection}
            votes={sections.closed}
            onOpen={(id) => navigation.navigate('VotingDetail', { voteId: id })}
          />
        </View>
      ) : null}
    </AppScrollView>
  );
};

const VoteSection = ({
  label,
  votes,
  onOpen,
}: {
  label: string;
  votes: Vote[];
  onOpen: (id: number | string) => void;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>{label}</Text>
    {votes.length === 0 ? <Text style={styles.sectionEmpty}>{VOTING_COPY.sectionEmpty}</Text> : null}
    <View style={styles.list}>
      {votes.map((vote) => {
        const subline = voteRowSubline(vote);
        const chip = audienceChip(vote);
        return (
          <Pressable
            key={String(vote.id)}
            accessibilityRole="button"
            accessibilityLabel={`${vote.title}. ${subline}. ${chip}${vote.hasVoted ? `. ${VOTING_COPY.voted}` : ''}`}
            onPress={() => onOpen(vote.id)}
            style={styles.row}
          >
            <View style={styles.rowCopy}>
              <View style={styles.titleRow}>
                <Text style={styles.rowTitle}>{vote.title}</Text>
                {vote.hasVoted ? (
                  <View style={styles.voted}>
                    <Text style={styles.votedText}>{VOTING_COPY.voted}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{subline}</Text>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{chip}</Text>
                </View>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
          </Pressable>
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: appTypography.heading, fontSize: 34, lineHeight: 40, color: appColors.ink, fontWeight: '700' },
  plus: { width: 48, height: 48, borderRadius: 24, backgroundColor: appColors.primary, alignItems: 'center', justifyContent: 'center' },
  sections: { gap: 24, marginTop: 24 },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: appColors.mutedInk,
    textTransform: 'uppercase',
  },
  sectionEmpty: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14 },
  list: { gap: 12 },
  skeleton: { height: 76, borderRadius: 18, backgroundColor: '#efe8e4' },
  row: {
    backgroundColor: appColors.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  rowCopy: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontFamily: appTypography.heading, fontSize: 20, lineHeight: 26, color: appColors.ink, fontWeight: '700' },
  voted: { borderRadius: 999, backgroundColor: '#f9e8ee', paddingHorizontal: 8, paddingVertical: 2 },
  votedText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  meta: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20 },
  chip: { borderRadius: 999, backgroundColor: '#f3eeeb', paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { color: appColors.ink, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  empty: { marginTop: 48, gap: 8, paddingHorizontal: 12, alignItems: 'center' },
  emptyTitle: { fontFamily: appTypography.heading, fontSize: 22, color: appColors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: appTypography.bodyRegular, fontSize: 16, lineHeight: 22, color: appColors.mutedInk, textAlign: 'center' },
  emptyCta: { marginTop: 16, minHeight: 54, borderRadius: 999, backgroundColor: appColors.primary, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  emptyCtaText: { color: appColors.white, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  error: { color: appColors.danger, fontFamily: appTypography.bodyRegular, fontSize: 16, textAlign: 'center' },
  retry: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
});
