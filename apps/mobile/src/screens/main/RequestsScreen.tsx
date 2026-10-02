import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { ActionSheet, BlockSheet, ReportSheet } from '@components/foyer/SafetySheets';
import { InlineError, PillButton, SheetButtons, Toast } from '@components/foyer/ui';
import { ScrollView, View } from '@components/RNCompat';
import { APPROVAL_COPY, FULL_COPY, MEMBER_COPY } from '@constants/foyerCopy';
import {
  MAX_DECLINE_NOTE,
  canApprove,
  cardInitials,
  clampDeclineNote,
  describeDecisionError,
  isMinorCard,
  isRequestClosedByStart,
  memberRowLabel,
  partyFits,
  partyLine,
  type JoinRequest,
  type RequestStatus,
} from '@foyer/approval';
import { useSwipeCard } from '@hooks/useSwipeCard';
import type { MainStackParamList } from '@navigation/types';
import { fetchActivity } from '@services/activityService';
import {
  approveJoinRequest,
  declineJoinRequest,
  fetchJoinRequests,
  type RequestStatusFilter,
} from '@services/foyerService';
import { blockUser } from '@services/moderationService';
import { submitReport } from '@services/reportAdapter';
import { appColors, appTypography, radii } from '@theme/index';

type View_ = 'deck' | 'list';
type SafetyTarget = { userId: number | null; requestId: number; name: string } | null;

/**
 * Host's Require approval deck (frames 54-62, 67). Swipe right or tap Approve; swipe left or tap
 * Decline (which opens the optional note sheet). No undo. Once the gathering starts every pending
 * request is read-only with a Closed tag.
 */
export const RequestsScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'Requests'>>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const activityId = route.params.activityId;

  const [view, setView] = useState<View_>('deck');
  const [tab, setTab] = useState<RequestStatusFilter>('pending');
  const [reviewed, setReviewed] = useState(0);
  const [declineTarget, setDeclineTarget] = useState<JoinRequest | null>(null);
  const [note, setNote] = useState('');
  const [decideError, setDecideError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [noFitFor, setNoFitFor] = useState<number | null>(null);
  const [closedByServer, setClosedByServer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [safety, setSafety] = useState<SafetyTarget>(null);
  const [safetySheet, setSafetySheet] = useState<'menu' | 'report' | 'block' | null>(null);

  const activityQuery = useQuery({ queryKey: ['foyer-gathering', activityId], queryFn: () => fetchActivity(activityId) });
  const activity = activityQuery.data;
  const closed = closedByServer || isRequestClosedByStart(activity);

  const pendingQuery = useQuery({
    queryKey: ['foyer-requests', activityId, 'pending'],
    queryFn: () => fetchJoinRequests(activityId, 'pending'),
  });
  const listQuery = useQuery({
    queryKey: ['foyer-requests', activityId, tab],
    queryFn: () => fetchJoinRequests(activityId, tab),
    enabled: view === 'list' && tab !== 'pending',
  });

  const pending = pendingQuery.data?.requests ?? [];
  const spotsLeft = pendingQuery.data?.spots_left ?? null;
  const top = pending[0] ?? null;
  const going = activity?.going_count ?? activity?.participant_count ?? 0;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['foyer-requests', activityId] }),
      queryClient.invalidateQueries({ queryKey: ['foyer-gathering', activityId] }),
      queryClient.invalidateQueries({ queryKey: ['foyer-hosted'] }),
    ]);
  };

  /** Approve: 409 puts the "doesn't fit" state on the card; 400 closes the screen. Resolves true when it went through. */
  const approve = async (request: JoinRequest): Promise<boolean> => {
    if (closed || deciding) {
      return false;
    }
    if (!partyFits(request, spotsLeft)) {
      setNoFitFor(request.id);
      return false;
    }
    setDeciding(true);
    setDecideError(null);
    try {
      await approveJoinRequest(activityId, request.id);
      setReviewed((count) => count + 1);
      setNoFitFor(null);
      setToast(APPROVAL_COPY.approvedToast);
      await refresh();
      return true;
    } catch (failure) {
      const described = describeDecisionError(failure);
      if (described.kind === 'noFit') {
        setNoFitFor(request.id);
      } else if (described.kind === 'closed') {
        setClosedByServer(true);
      } else {
        setDecideError(described.message);
      }
      return false;
    } finally {
      setDeciding(false);
    }
  };

  const decline = async () => {
    if (!declineTarget || deciding) {
      return;
    }
    setDeciding(true);
    setDecideError(null);
    try {
      // The note travels in the decline push text; this screen never displays it.
      await declineJoinRequest(activityId, declineTarget.id, note);
      setDeclineTarget(null);
      setNote('');
      setReviewed((count) => count + 1);
      setToast(APPROVAL_COPY.declinedToast);
      await refresh();
    } catch (failure) {
      const described = describeDecisionError(failure);
      if (described.kind === 'closed') {
        setDeclineTarget(null);
        setClosedByServer(true);
      } else {
        setDecideError(described.message);
      }
    } finally {
      setDeciding(false);
    }
  };

  const swipe = useSwipeCard({
    enabled: view === 'deck' && Boolean(top) && !closed && !deciding && !declineTarget,
    resetKey: top ? String(top.id) : null,
    onCommit: async (direction) => {
      if (!top) {
        return false;
      }
      if (direction === 'right') {
        return approve(top);
      }
      setNote('');
      setDecideError(null);
      setDeclineTarget(top);
      return false;
    },
  });

  const openSafety = (request: JoinRequest) => {
    setSafety({ userId: request.user_id ?? null, requestId: request.id, name: request.card.first_name });
    setSafetySheet('menu');
  };

  const approveStamp = swipe.pan.x.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
  const declineStamp = swipe.pan.x.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const backToGathering = () => navigation.goBack();
  const showApproved = () => {
    setTab('approved');
    setView('list');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={backToGathering} style={styles.topButton}>
          <Text maxFontSizeMultiplier={1.4} style={styles.topAction}>{`‹ ${APPROVAL_COPY.deckBack}`}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.navTitle}>{APPROVAL_COPY.deckTitle}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setView((current) => (current === 'deck' ? 'list' : 'deck'))}
          style={[styles.topButton, styles.topRight]}
        >
          <Text maxFontSizeMultiplier={1.4} style={styles.topAction}>{view === 'deck' ? APPROVAL_COPY.deckList : APPROVAL_COPY.deckTitle}</Text>
        </Pressable>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {closed ? (
          <ClosedView
            requests={pending}
            onBack={backToGathering}
          />
        ) : view === 'list' ? (
          <ListView
            tab={tab}
            onTab={setTab}
            requests={tab === 'pending' ? pending : listQuery.data?.requests ?? []}
            onMore={openSafety}
            onApproveDeclined={(request) => void approve(request)}
          />
        ) : !top ? (
          reviewed > 0 ? (
            <View style={styles.center}>
              <Text style={styles.bigTitle}>{APPROVAL_COPY.reviewedTitle}</Text>
              <Text style={styles.meta}>{APPROVAL_COPY.reviewedSummary(going, spotsLeft)}</Text>
              <PillButton label={APPROVAL_COPY.seeApproved} onPress={showApproved} />
              <PillButton label={APPROVAL_COPY.backToGathering} variant="text" onPress={backToGathering} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.bigTitle}>{APPROVAL_COPY.emptyTitle}</Text>
              <Text style={styles.meta}>{APPROVAL_COPY.emptyBody}</Text>
              <PillButton label={APPROVAL_COPY.backToGathering} onPress={backToGathering} />
            </View>
          )
        ) : (
          <>
            <Text style={styles.summary}>{APPROVAL_COPY.deckSummary(pendingQuery.data?.pending_count ?? pending.length, spotsLeft)}</Text>
            {spotsLeft === 0 ? <Text style={styles.meta} testID="full-caption">{FULL_COPY.hostCaption}</Text> : null}
            <Animated.View style={[swipe.cardStyle]} {...swipe.panHandlers}>
              <RequestCard
                request={top}
                noFit={noFitFor === top.id}
                spotsLeft={spotsLeft}
                onMore={() => openSafety(top)}
              />
              <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampApprove, { opacity: approveStamp }]}>
                <Text style={[styles.stampText, { color: appColors.primary }]}>{APPROVAL_COPY.stampApprove}</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampDecline, { opacity: declineStamp }]}>
                <Text style={[styles.stampText, { color: appColors.ink }]}>{APPROVAL_COPY.stampDecline}</Text>
              </Animated.View>
            </Animated.View>
            <InlineError message={decideError} />
            <View style={styles.roundRow}>
              <RoundButton
                label={APPROVAL_COPY.decline}
                filled={false}
                disabled={deciding}
                onPress={() => void swipe.commit('left')}
              />
              <RoundButton
                label={APPROVAL_COPY.approve}
                filled
                disabled={deciding || !partyFits(top, spotsLeft) || noFitFor === top.id}
                onPress={() => void swipe.commit('right')}
              />
            </View>
            <Text style={styles.hint}>
              {noFitFor === top.id || !partyFits(top, spotsLeft)
                ? APPROVAL_COPY.noFitCaption(spotsLeft ?? 0)
                : APPROVAL_COPY.swipeHint}
            </Text>
          </>
        )}
      </ScrollView>

      <FoyerSheet
        visible={Boolean(declineTarget)}
        onDismiss={() => (deciding ? undefined : setDeclineTarget(null))}
        footer={
          <SheetButtons>
            <InlineError message={decideError} />
            <PillButton label={APPROVAL_COPY.decline} loading={deciding} onPress={() => void decline()} testID="decline-confirm" />
            <PillButton label="Cancel" variant="outline" disabled={deciding} onPress={() => setDeclineTarget(null)} />
          </SheetButtons>
        }
      >
        {declineTarget ? (
          <>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              {APPROVAL_COPY.declineTitle(declineTarget.card.first_name)}
            </Text>
            <Text style={styles.label}>{APPROVAL_COPY.declineNoteLabel}</Text>
            <TextInput
              accessibilityLabel={APPROVAL_COPY.declineNoteLabel}
              value={note}
              onChangeText={(value) => setNote(clampDeclineNote(value))}
              maxLength={MAX_DECLINE_NOTE}
              multiline
              editable={!deciding}
              style={styles.noteInput}
            />
            <Text style={styles.counter}>{APPROVAL_COPY.declineCounter(note.length, MAX_DECLINE_NOTE)}</Text>
            <Text style={styles.meta}>{APPROVAL_COPY.declineHelper(declineTarget.card.first_name)}</Text>
          </>
        ) : null}
      </FoyerSheet>

      <ActionSheet
        visible={safetySheet === 'menu'}
        onClose={() => setSafetySheet(null)}
        rows={[
          { label: MEMBER_COPY.reportName(safety?.name ?? ''), onPress: () => setSafetySheet('report'), testID: 'request-report' },
          ...(safety?.userId != null
            ? [{ label: MEMBER_COPY.blockName(safety.name), onPress: () => setSafetySheet('block'), testID: 'request-block' }]
            : []),
        ]}
      />
      <ReportSheet
        visible={safetySheet === 'report'}
        name={safety?.name ?? ''}
        onClose={() => setSafetySheet(null)}
        onSubmit={(payload) =>
          submitReport({ type: 'join_request', userId: safety?.userId ?? null, requestId: safety?.requestId ?? null, activityId }, payload)
        }
        onSent={() => {
          setSafetySheet(null);
          setToast(MEMBER_COPY.reportSent);
        }}
      />
      <BlockSheet
        visible={safetySheet === 'block'}
        name={safety?.name ?? ''}
        onClose={() => setSafetySheet(null)}
        onConfirm={() => (safety?.userId != null ? blockUser(safety.userId) : Promise.resolve())}
        onDone={() => {
          setSafetySheet(null);
          void refresh();
        }}
      />
      {toast ? <Toast message={toast} autoDismissMs={3000} onDismiss={() => setToast(null)} /> : null}
    </View>
  );
};

const RequestCard = ({
  request,
  noFit,
  spotsLeft,
  onMore,
}: {
  request: JoinRequest;
  noFit: boolean;
  spotsLeft: number | null;
  onMore: () => void;
}) => {
  const minor = isMinorCard(request);
  const misfit = noFit || !partyFits(request, spotsLeft);
  return (
    <View style={styles.card}>
      <View style={styles.photoWrap}>
        {request.card.avatar_url ? (
          <Image source={{ uri: request.card.avatar_url }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoInitials]}>
            <Text style={styles.initials}>{cardInitials(request.card.first_name)}</Text>
          </View>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={MEMBER_COPY.reportOrBlock} onPress={onMore} style={styles.more} testID="request-more">
          <MaterialCommunityIcons name="dots-horizontal" size={22} color="#ffffff" />
        </Pressable>
        <View style={styles.photoOverlay}>
          <Text style={styles.cardName}>
            {minor && request.card.age_band ? `${request.card.first_name}, ${request.card.age_band}` : request.card.first_name}
          </Text>
          {request.card.church_name ? (
            <View style={styles.churchTag}>
              <Text style={styles.churchTagText}>{request.card.church_name}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.cardBody}>
        {minor ? (
          <Text style={styles.meta}>{APPROVAL_COPY.minorLine}</Text>
        ) : request.card.bio ? (
          <>
            <Text style={styles.label}>{APPROVAL_COPY.about}</Text>
            <Text style={styles.body}>{request.card.bio}</Text>
          </>
        ) : null}
        <Text style={styles.label}>{APPROVAL_COPY.party}</Text>
        <View style={styles.partyPill} testID="party-pill">
          <Text style={styles.partyPillText}>{partyLine(request)}</Text>
        </View>
        {(request.party.members ?? []).map((member, index) => (
          <View key={`${member.name}-${index}`} style={styles.memberRow}>
            <Text style={styles.memberName}>{member.name}</Text>
            {memberRowLabel(member) ? (
              <View style={styles.bandChip} testID="member-band-chip">
                <Text style={styles.bandChipText}>{memberRowLabel(member)}</Text>
              </View>
            ) : null}
          </View>
        ))}
        {misfit ? (
          <View style={styles.noFit} accessibilityRole="alert">
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#8a0a1f" />
            <Text style={styles.noFitText}>{APPROVAL_COPY.noFit}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const RoundButton = ({ label, filled, disabled, onPress }: { label: string; filled: boolean; disabled: boolean; onPress: () => void }) => (
  <View style={styles.roundWrap}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.round,
        filled ? styles.roundFilled : styles.roundOutline,
        disabled ? styles.roundDisabled : null,
      ]}
    >
      <MaterialCommunityIcons name={filled ? 'check' : 'close'} size={28} color={disabled ? '#7a7572' : filled ? '#ffffff' : appColors.ink} />
    </Pressable>
    <Text style={styles.roundLabel}>{label}</Text>
  </View>
);

const STATUS_TABS: Array<{ value: RequestStatusFilter; label: string }> = [
  { value: 'pending', label: APPROVAL_COPY.tabPending },
  { value: 'approved', label: APPROVAL_COPY.tabApproved },
  { value: 'declined', label: APPROVAL_COPY.tabDeclined },
];

const ListView = ({
  tab,
  onTab,
  requests,
  onMore,
  onApproveDeclined,
}: {
  tab: RequestStatusFilter;
  onTab: (tab: RequestStatusFilter) => void;
  requests: JoinRequest[];
  onMore: (request: JoinRequest) => void;
  onApproveDeclined: (request: JoinRequest) => void;
}) => (
  <View style={styles.listWrap}>
    <View style={styles.tabs}>
      {STATUS_TABS.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="button"
          accessibilityState={{ selected: tab === item.value }}
          onPress={() => onTab(item.value)}
          style={[styles.tab, tab === item.value ? styles.tabOn : null]}
        >
          <Text style={[styles.tabText, tab === item.value ? styles.tabTextOn : null]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
    {requests.length === 0 ? <Text style={styles.meta}>{APPROVAL_COPY.emptyTitle}</Text> : null}
    {requests.map((request) => (
      <View key={request.id} style={styles.listRow}>
        {request.card.avatar_url ? (
          <Image source={{ uri: request.card.avatar_url }} style={styles.listAvatar} />
        ) : (
          <View style={[styles.listAvatar, styles.photoInitials]}>
            <Text style={styles.listInitials}>{cardInitials(request.card.first_name)}</Text>
          </View>
        )}
        <View style={styles.listCopy}>
          <Text style={styles.memberName}>{request.card.first_name}</Text>
          <Text style={styles.meta}>{`Party of ${request.party.size}`}</Text>
          {request.status === 'declined' && request.decline_reason?.trim() ? (
            <Text style={styles.meta} testID="list-decline-note">{`\u201C${request.decline_reason.trim()}\u201D`}</Text>
          ) : null}
        </View>
        {request.status === 'approved' ? <StatusChip status="approved" /> : null}
        {request.status === 'declined' && canApprove(request) ? (
          <PillButton label={APPROVAL_COPY.approve} variant="text" onPress={() => onApproveDeclined(request)} />
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={MEMBER_COPY.reportOrBlock} onPress={() => onMore(request)} style={styles.moreList}>
          <MaterialCommunityIcons name="dots-horizontal" size={22} color={appColors.mutedInk} />
        </Pressable>
      </View>
    ))}
  </View>
);

const StatusChip = ({ status }: { status: RequestStatus }) => (
  <View style={styles.statusChip}>
    <MaterialCommunityIcons name="check" size={13} color={appColors.primary} />
    <Text style={styles.statusChipText}>{status === 'approved' ? APPROVAL_COPY.approvedChip : ''}</Text>
  </View>
);

/** Event started: pending cards stay visible, read-only, tagged Closed. No Approve or Decline. */
const ClosedView = ({ requests, onBack }: { requests: JoinRequest[]; onBack: () => void }) => (
  <View style={styles.listWrap} testID="requests-closed">
    <Text accessibilityRole="header" style={styles.bigTitle}>{APPROVAL_COPY.deckClosedTitle}</Text>
    <Text style={styles.meta}>{APPROVAL_COPY.deckClosedBody}</Text>
    {requests.map((request) => (
      <View key={request.id} style={styles.listRow}>
        {request.card.avatar_url ? (
          <Image source={{ uri: request.card.avatar_url }} style={styles.listAvatar} />
        ) : (
          <View style={[styles.listAvatar, styles.photoInitials]}>
            <Text style={styles.listInitials}>{cardInitials(request.card.first_name)}</Text>
          </View>
        )}
        <View style={styles.listCopy}>
          <Text style={styles.memberName}>{request.card.first_name}</Text>
          <Text style={styles.meta}>{`Party of ${request.party.size}`}</Text>
        </View>
        <View style={styles.closedTag}>
          <Text style={styles.closedTagText}>{APPROVAL_COPY.tagClosed}</Text>
        </View>
      </View>
    ))}
    <PillButton label={APPROVAL_COPY.backToGathering} variant="text" onPress={onBack} />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: appColors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: appColors.background },
  topButton: { minHeight: 48, minWidth: 80, justifyContent: 'center' },
  topRight: { alignItems: 'flex-end' },
  topAction: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.primary },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: appTypography.heading, fontSize: 18, lineHeight: 24, color: appColors.ink },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  bigTitle: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink, textAlign: 'center' },
  summary: { fontFamily: appTypography.bodySemibold, fontSize: 14, color: appColors.mutedInk, textAlign: 'center' },
  meta: { fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, color: appColors.mutedInk },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
  label: { fontFamily: appTypography.bodySemibold, fontSize: 12, letterSpacing: 0.6, color: appColors.mutedInk },
  card: { backgroundColor: appColors.white, borderRadius: radii.card, overflow: 'hidden' },
  photoWrap: { height: 280, backgroundColor: appColors.primarySoft },
  photo: { width: '100%', height: '100%' },
  photoInitials: { alignItems: 'center', justifyContent: 'center', backgroundColor: appColors.primarySoft },
  initials: { fontFamily: appTypography.heading, fontSize: 72, color: appColors.primary },
  photoOverlay: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 6 },
  cardName: { fontFamily: appTypography.heading, fontSize: 30, lineHeight: 38, color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  churchTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  churchTagText: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.primary },
  more: { position: 'absolute', top: 10, right: 10, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  cardBody: { padding: 16, gap: 6 },
  partyPill: { alignSelf: 'flex-start', backgroundColor: '#a2033f', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  partyPillText: { fontFamily: appTypography.bodySemibold, fontSize: 14, lineHeight: 20, color: '#ffffff' },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 4 },
  bandChip: { borderRadius: 999, backgroundColor: '#efe9e5', paddingHorizontal: 10, paddingVertical: 4 },
  bandChipText: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.ink },
  memberName: { fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.ink },
  noFit: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fde8e8', borderRadius: 12, padding: 10, marginTop: 8 },
  noFitText: { flex: 1, color: '#8a0a1f', fontFamily: appTypography.bodySemibold, fontSize: 14 },
  stamp: { position: 'absolute', top: 24, borderWidth: 3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.9)' },
  stampApprove: { left: 20, borderColor: appColors.primary, transform: [{ rotate: '-12deg' }] },
  stampDecline: { right: 20, borderColor: appColors.ink, transform: [{ rotate: '12deg' }] },
  stampText: { fontFamily: appTypography.bodySemibold, fontSize: 24, letterSpacing: 1 },
  roundRow: { flexDirection: 'row', justifyContent: 'center', gap: 48, marginTop: 8 },
  roundWrap: { alignItems: 'center', gap: 6 },
  round: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  roundFilled: { backgroundColor: '#a2033f' },
  roundOutline: { borderWidth: 2, borderColor: '#222222', backgroundColor: '#ffffff' },
  roundDisabled: { backgroundColor: '#e1dbd7', borderColor: '#e1dbd7' },
  roundLabel: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.ink },
  hint: { textAlign: 'center', fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  sheetTitle: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  noteInput: {
    minHeight: 96,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    paddingTop: 12,
    color: appColors.ink,
    fontFamily: appTypography.bodyRegular,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontFamily: appTypography.bodyRegular, fontSize: 12.5, color: appColors.mutedInk },
  listWrap: { gap: 12 },
  tabs: { flexDirection: 'row', backgroundColor: appColors.white, borderRadius: 12, padding: 4 },
  tab: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabOn: { borderWidth: 1, borderColor: appColors.line },
  tabText: { fontFamily: appTypography.bodyMedium, color: appColors.mutedInk },
  tabTextOn: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: appColors.white, borderRadius: radii.list, padding: 12, minHeight: 64 },
  listAvatar: { width: 44, height: 44, borderRadius: 22 },
  listInitials: { fontFamily: appTypography.bodySemibold, fontSize: 18, color: appColors.primary },
  listCopy: { flex: 1, gap: 2 },
  moreList: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: appColors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusChipText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  closedTag: { backgroundColor: '#f3f0ee', borderWidth: 1.5, borderColor: '#cec8c4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  closedTagText: { color: '#7a7572', fontFamily: appTypography.bodySemibold, fontSize: 12 },
});
