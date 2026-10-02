import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';

import { AddToCalendarSheet } from '@components/AddToCalendarSheet';
import { AppScrollView } from '@components/AppChrome';
import { CancelGatheringSheet } from '@components/foyer/CancelGatheringSheet';
import { CancelRsvpSheet } from '@components/foyer/CancelRsvpSheet';
import { HostAttendeesCard } from '@components/foyer/HostAttendeesCard';
import { PastAttendeesCard } from '@components/foyer/PastAttendeesCard';
import { PhotoUploadSheet } from '@components/foyer/PhotoUploadSheet';
import { PillButton, Toast } from '@components/foyer/ui';
import { RefreshControl, View } from '@components/RNCompat';
import { WhosComingSheet } from '@components/WhosComingSheet';
import { APPROVAL_COPY, ATTENDEE_COPY, CANCEL_COPY, FULL_COPY, GOING_COPY, PHOTO_COPY } from '@constants/foyerCopy';
import {
  declineNoteFor,
  gatheringRequiresApproval,
  guestRequestView,
  isApprovalActive,
  joinButtonFor,
  type GuestRequestView,
} from '@foyer/approval';
import { canHostEdit, cancelledDateLabel, hostCancelState, isActivityCancelled } from '@foyer/cancel';
import { useDetectedCapabilities } from '@foyer/capabilities';
import { fullBlocksJoin, fullNotice, isFullMessage } from '@foyer/full';
import { buildPastAttendees, isHostAttendeeView } from '@foyer/attendees';
import { formatGatheringWhen } from '@foyer/dates';
import { openGatheringChat } from '@foyer/gatheringChat';
import { canCancelRsvp, canSeeChat, hasEventStarted, isGoingRsvp } from '@foyer/rsvp';
import type { WhosComingResponse } from '@foyer/logic';
import { MAX_GATHERING_PHOTOS, compressGatheringPhoto } from '@foyer/photos';
import {
  audienceChipLabel,
  coverPhotoUrl,
  gatheringLocationLabel,
  friendlyRsvpMessage,
  goingCountLabel,
  hostDisplayName,
} from '@foyer/logic';
import { gatheringCalendarUrls, openCalendarUrl } from '@foyer/openCalendar';
import { calendarEventSummary } from '@shared/calendarLinks';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { fetchActivity } from '@services/activityService';
import { fetchAttendees, fetchWhosComing, postRsvp, uploadGatheringPhoto } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

export const GatheringDetailScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'GatheringDetail'>>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [pickedUris, setPickedUris] = useState<string[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelledToast, setCancelledToast] = useState(false);
  const [cancelGatheringOpen, setCancelGatheringOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [askSheet, setAskSheet] = useState<WhosComingResponse | null>(null);
  const [askPending, setAskPending] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askMode, setAskMode] = useState<'request' | 'rsvp'>('request');
  const navigation = useNavigation<any>();
  const activityId = route.params.activityId;

  useDetectedCapabilities();
  const activityQuery = useQuery({
    queryKey: ['foyer-gathering', activityId],
    queryFn: () => fetchActivity(activityId),
  });

  const uploadMutation = useMutation({
    mutationFn: async (uris: string[]) => {
      // One at a time so a failure keeps the photos already added.
      for (const uri of uris) {
        const compressed = await compressGatheringPhoto(uri);
        await uploadGatheringPhoto(activityId, compressed);
      }
    },
    onSuccess: async () => {
      setError(null);
      setPickedUris([]);
      await queryClient.invalidateQueries({ queryKey: ['foyer-gathering', activityId] });
    },
    onError: (uploadError) => setError(getErrorMessage(uploadError, 'Unable to add those photos.')),
  });

  const activity = activityQuery.data;
  const photoUrls = activity
    ? [
        ...(activity.photos?.map((photo) => photo.url).filter((url): url is string => Boolean(url)) ?? []),
        ...(activity.images ?? []),
      ].filter((url, index, all) => all.indexOf(url) === index)
    : [];
  const hostId = activity && typeof activity.host === 'object' ? activity.host.id : null;
  const isHost = hostId != null && user?.id != null && String(hostId) === String(user.id);
  const isGoing = isGoingRsvp(activity?.my_rsvp);
  const churchAdmin = Boolean(activity?.host_kind === 'church' && user?.isChurchAdmin);
  const canAdd = (isHost || isGoing || churchAdmin) && photoUrls.length < MAX_GATHERING_PHOTOS;
  const started = hasEventStarted(activity?.time);
  const cancelled = isActivityCancelled(activity);
  const requestView: GuestRequestView = isHost ? 'none' : guestRequestView(activity);
  const requestLocked = requestView !== 'none' && requestView !== 'approved';
  const showCancel = !cancelled && canCancelRsvp({ isHost, isGoing, time: activity?.time });
  const hostControls = hostCancelState({ isHost, isChurchAdminOfChurchEvent: churchAdmin, activity });
  const canEdit = (isHost || churchAdmin) && canHostEdit({ isHost: true, activity });
  const approvalHost = (isHost || churchAdmin) && isApprovalActive(activity) && (gatheringRequiresApproval(activity) || Number(activity?.pending_count ?? 0) > 0);
  const joinButton = joinButtonFor(activity, "I'm going");
  const fullBlocked = fullBlocksJoin({ activity, isHost, isGoing });
  const canJoinHere = !isHost && !isGoing && !cancelled && !started && requestView === 'none' && !churchAdmin;
  const showChat = !requestLocked && canSeeChat({ isHost, isGoing, isChurchAdminOfChurchEvent: churchAdmin });

  // Host: households. Going guest after the event starts: names. Anyone else: nothing (403 -> null).
  const attendeesQuery = useQuery({
    queryKey: ['foyer-attendees', activityId],
    queryFn: () => fetchAttendees(activityId),
    enabled: Boolean(activity) && !requestLocked && (isHost || (isGoing && started)),
    retry: false,
  });
  const hostView = isHost && isHostAttendeeView(attendeesQuery.data ?? null);
  const pastAttendees = started && !isHost ? buildPastAttendees(attendeesQuery.data ?? null) : [];

  const openAskAgain = async (mode: 'request' | 'rsvp' = 'request') => {
    setAskMode(mode);
    setAskError(null);
    setAskPending(true);
    try {
      setAskSheet(await fetchWhosComing(activityId));
    } catch (failure) {
      setToast({ message: friendlyRsvpMessage(getErrorMessage(failure, 'Unable to open the request.')), error: true });
    } finally {
      setAskPending(false);
    }
  };

  const sendRequest = async (payload: { include_self: boolean; dependent_ids: number[]; member_ids?: number[] }) => {
    setAskPending(true);
    setAskError(null);
    try {
      const result = await postRsvp(activityId, payload);
      setAskSheet(null);
      const pendingResult = result?.status === 'pending' || result?.my_request_status === 'pending';
      setToast({ message: pendingResult ? APPROVAL_COPY.requestSent : GOING_COPY.title });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['foyer-gathering', activityId] }),
        queryClient.invalidateQueries({ queryKey: ['foyer-going'] }),
      ]);
    } catch (failure) {
      const message = friendlyRsvpMessage(getErrorMessage(failure, 'Unable to send your request.'));
      if (isFullMessage(message)) {
        // The last spot went (frame 76): close the sheet, show the error inline under the button, refresh so it disables.
        setAskSheet(null);
        setAskError(FULL_COPY.notice);
      } else {
        // Stale screens: show the server's own words (cancelled / declined) and refresh.
        setAskError(message);
      }
      void queryClient.invalidateQueries({ queryKey: ['foyer-gathering', activityId] });
    } finally {
      setAskPending(false);
    }
  };

  const pickPhoto = async () => {
    // The system photo picker needs no library permission (add-only access is used for saving).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_GATHERING_PHOTOS - photoUrls.length),
    });
    const uris = (result.assets ?? []).map((asset) => asset.uri).filter(Boolean);
    if (result.canceled || uris.length === 0) {
      return;
    }
    setPickedUris(uris);
  };

  if (!activity) {
    return (
      <AppScrollView contentContainerStyle={styles.container}>
        <Text style={styles.meta}>{activityQuery.isLoading ? 'Loading…' : 'This gathering is unavailable.'}</Text>
      </AppScrollView>
    );
  }

  const cover = coverPhotoUrl(activity);

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={activityQuery.isRefetching} onRefresh={() => void activityQuery.refetch()} />
      }
    >
      {cover ? (
        <Image source={{ uri: cover }} style={[styles.cover, cancelled ? styles.coverCancelled : null]} />
      ) : (
        <View style={[styles.cover, cancelled ? styles.coverCancelled : null]} />
      )}
      <Text style={styles.chip}>{audienceChipLabel(activity)}</Text>
      {isHost ? (
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>{CANCEL_COPY.hostingBadge}</Text>
        </View>
      ) : null}
      <Text style={[styles.title, cancelled ? styles.mutedText : null]}>{activity.title}</Text>
      {cancelled ? (
        <View style={styles.banner} accessibilityRole="alert">
          <MaterialCommunityIcons name="calendar-remove-outline" size={22} color="#5b5551" />
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerTitle}>{CANCEL_COPY.bannerTitle}</Text>
            {activity.cancel_reason?.trim() ? <Text style={styles.bannerBody}>{activity.cancel_reason.trim()}</Text> : null}
            {cancelledDateLabel(activity.cancelled_at) ? (
              <Text style={styles.bannerMeta}>{cancelledDateLabel(activity.cancelled_at)}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {requestLocked ? <RequestBanner view={requestView} note={declineNoteFor(activity)} /> : null}
      {requestView === 'approved' ? (
        <View style={styles.banner}>
          <MaterialCommunityIcons name="check-circle-outline" size={22} color={appColors.primary} />
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerTitle}>{APPROVAL_COPY.approvedTitle}</Text>
            <Text style={styles.bannerBody}>{APPROVAL_COPY.approvedBody}</Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.meta}>{goingCountLabel(activity.going_count ?? activity.participant_count ?? 0)}</Text>
      {activity.time ? (
        <Text style={[styles.meta, cancelled ? styles.struck : null]}>
          {formatGatheringWhen(activity.time)}
        </Text>
      ) : null}
      {started && !cancelled ? <Text style={styles.pastLabel}>{ATTENDEE_COPY.pastLabel}</Text> : null}
      {isGoing && !cancelled && !requestLocked ? (
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>{GOING_COPY.title}</Text>
        </View>
      ) : null}
      {cancelled && isGoing ? (
        <View style={styles.cancelledRow}>
          <PillButton label={CANCEL_COPY.guestPill} disabled onPress={() => undefined} style={styles.cancelledPill} />
          <Text style={styles.meta}>{CANCEL_COPY.guestNote}</Text>
        </View>
      ) : null}
      {fullNotice(fullBlocked) ? (
        <View style={styles.banner} accessibilityRole="alert" testID="full-notice">
          <MaterialCommunityIcons name="account-group-outline" size={22} color="#5b5551" />
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerTitle}>{FULL_COPY.banner}</Text>
          </View>
        </View>
      ) : null}
      {canJoinHere ? (
        <PillButton
          label={fullBlocked ? FULL_COPY.buttonLabel : joinButton.label}
          disabled={fullBlocked}
          loading={askPending}
          onPress={() => void openAskAgain(joinButton.kind === 'request' ? 'request' : 'rsvp')}
          testID="join-button"
        />
      ) : null}
      {canJoinHere && fullBlocked ? (
        <PillButton
          label={APPROVAL_COPY.browseOthers}
          variant="text"
          onPress={() => navigation.navigate('Tabs', { screen: 'Discover' })}
          style={styles.alignStart}
        />
      ) : null}
      {canJoinHere && askError && !askSheet ? (
        <Text accessibilityRole="alert" style={styles.error} testID="join-error">
          {askError}
        </Text>
      ) : null}
      {!isHost && !cancelled && requestView === 'pending' ? (
        <PillButton label={APPROVAL_COPY.cancelRequest} variant="outline" onPress={() => setCancelOpen(true)} testID="cancel-request" />
      ) : null}
      {!isHost && !cancelled && (requestView === 'pendingClosed' || requestView === 'declined' || requestView === 'declinedClosed') ? (
        <>
          <PillButton
            label={joinButton.kind === 'askAgain' && requestView === 'declined' ? APPROVAL_COPY.askAgain : APPROVAL_COPY.requestClosed}
            disabled={!(joinButton.kind === 'askAgain' && requestView === 'declined')}
            loading={askPending}
            onPress={() => void openAskAgain()}
            testID="request-button"
          />
          {joinButton.kind === 'askAgain' && requestView === 'declined' && declineNoteFor(activity) ? (
            <Text style={styles.helperCaption}>{APPROVAL_COPY.askAgainClearsNote}</Text>
          ) : null}
          {askError && !askSheet ? <Text style={styles.error}>{askError}</Text> : null}
          <PillButton
            label={APPROVAL_COPY.browseOthers}
            variant="text"
            onPress={() => navigation.navigate('Tabs', { screen: 'Discover' })}
            style={styles.alignStart}
          />
        </>
      ) : null}
      {showCancel && requestView !== 'pending' ? (
        <PillButton label={GOING_COPY.cancelRsvp} variant="text" onPress={() => setCancelOpen(true)} style={styles.alignStart} />
      ) : null}
      {canEdit ? (
        <PillButton
          label={CANCEL_COPY.edit}
          variant="outline"
          onPress={() => navigation.navigate('EditActivity', { activityId })}
          style={styles.alignStart}
          testID="edit-gathering"
        />
      ) : null}
      {approvalHost ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={APPROVAL_COPY.requestsRow}
          onPress={() => navigation.navigate('Requests', { activityId })}
          style={styles.requestsRow}
          testID="requests-row"
        >
          <View style={styles.requestsCopy}>
            <Text style={styles.requestsTitle}>{APPROVAL_COPY.requestsRow}</Text>
            <Text style={styles.meta}>
              {activity.capacity
                ? APPROVAL_COPY.spotsLeftOf(Math.max(0, activity.capacity - (activity.going_count ?? activity.participant_count ?? 0)), activity.capacity)
                : APPROVAL_COPY.approvedOnly}
            </Text>
            {activity.capacity ? <Text style={styles.meta}>{APPROVAL_COPY.approvedOnly}</Text> : null}
            {activity.is_full === true ? <Text style={styles.meta}>{FULL_COPY.hostCaption}</Text> : null}
          </View>
          {Number(activity.pending_count ?? 0) > 0 ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{APPROVAL_COPY.newBadge(Number(activity.pending_count))}</Text>
            </View>
          ) : null}
          <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
        </Pressable>
      ) : null}
      <View style={styles.pillRow}>
        <PillButton
          label={GOING_COPY.photos}
          variant="outline"
          style={styles.pillEqual}
          onPress={() => navigation.navigate('PhotoGallery', { activityId })}
        />
        {showChat ? (
          <PillButton
            label={GOING_COPY.chat}
            variant="outline"
            style={styles.pillEqual}
            onPress={() =>
              openGatheringChat(navigation, { activityId, title: activity.title }, { fromGathering: true })
            }
          />
        ) : null}
      </View>
      {requestLocked ? (
        <View style={styles.lockedRow}>
          <MaterialCommunityIcons name="lock-outline" size={18} color={appColors.mutedInk} />
          <Text style={styles.meta}>{APPROVAL_COPY.addressLocked}</Text>
        </View>
      ) : (
        <Text style={styles.meta}>{gatheringLocationLabel(activity.location)}</Text>
      )}
      {activity.description ? <Text style={styles.body}>{activity.description}</Text> : null}
      <Text style={styles.meta}>Hosted by {hostDisplayName(activity)}</Text>
      {requestLocked ? (
        <View style={styles.lockedRow}>
          <MaterialCommunityIcons name="lock-outline" size={18} color={appColors.mutedInk} />
          <Text style={styles.meta}>{APPROVAL_COPY.guestListLocked}</Text>
        </View>
      ) : null}
      {hostView && attendeesQuery.data && cancelled ? (
        <Text style={styles.section}>
          {CANCEL_COPY.invitedHeading} · {CANCEL_COPY.rsvpedCount(activity.going_count ?? activity.participant_count ?? 0)}
        </Text>
      ) : null}
      {hostView && attendeesQuery.data ? <HostAttendeesCard data={attendeesQuery.data} /> : null}
      {pastAttendees.length > 0 ? (
        <PastAttendeesCard
          attendees={pastAttendees}
          onOpen={(userId) => navigation.navigate('MemberProfile', { userId })}
        />
      ) : null}
      {!cancelled && !requestLocked ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Add to calendar" onPress={() => setShowCalendar(true)}>
          <Text style={styles.add}>Add to calendar</Text>
        </Pressable>
      ) : null}
      {showCalendar ? (
        <Portal>
          <Modal
            visible
            onDismiss={() => setShowCalendar(false)}
            style={styles.sheetWrapper}
            contentContainerStyle={styles.sheetModal}
          >
            <AddToCalendarSheet
              summary={calendarEventSummary(activity.title, activity.time)}
              onGoogle={() => openCalendarUrl(gatheringCalendarUrls(activity).google)}
              onOutlook={() => openCalendarUrl(gatheringCalendarUrls(activity).outlook)}
              onApple={() => openCalendarUrl(gatheringCalendarUrls(activity).apple)}
              onDismiss={() => setShowCalendar(false)}
            />
          </Modal>
        </Portal>
      ) : null}

      <Text style={styles.section}>{PHOTO_COPY.galleryTitle(photoUrls.length)}</Text>
      <View style={styles.grid}>
        {photoUrls.slice(0, 12).map((url) => (
          <Image key={url} source={{ uri: url }} style={styles.thumb} />
        ))}
      </View>
      {canAdd ? (
        <PillButton
          label={uploadMutation.isPending ? 'Adding photos…' : `${PHOTO_COPY.uploadTitle} · ${photoUrls.length} of ${MAX_GATHERING_PHOTOS}`}
          variant="text"
          disabled={uploadMutation.isPending}
          onPress={() => void pickPhoto()}
          style={styles.alignStart}
        />
      ) : (
        <Text style={styles.meta}>
          {photoUrls.length >= MAX_GATHERING_PHOTOS
            ? PHOTO_COPY.atLimit(MAX_GATHERING_PHOTOS)
            : PHOTO_COPY.addOnlyGoing}
        </Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hostControls.kind === 'button' ? (
        <View style={styles.cancelBlock}>
          <PillButton
            label={CANCEL_COPY.cancelButton}
            variant="destructiveOutline"
            onPress={() => setCancelGatheringOpen(true)}
            testID="cancel-gathering"
          />
          <Text style={styles.helperText}>{hostControls.helper}</Text>
        </View>
      ) : null}
      {hostControls.kind === 'started' ? <Text style={styles.helperText}>{hostControls.helper}</Text> : null}
      <PhotoUploadSheet
        visible={pickedUris.length > 0}
        subtitle={`${activity.title}${activity.time ? ` · ${formatGatheringWhen(activity.time).split(' · ')[0]}` : ''}`}
        uris={pickedUris}
        pending={uploadMutation.isPending}
        error={uploadMutation.isError ? error : null}
        onUpload={() => uploadMutation.mutate(pickedUris)}
        onCancel={() => setPickedUris([])}
      />
      <CancelRsvpSheet
        visible={cancelOpen}
        activityId={activityId}
        title={activity.title}
        isHost={isHost}
        withdrawRequest={requestView === 'pending'}
        onClose={() => setCancelOpen(false)}
        onCancelled={() => {
          setCancelOpen(false);
          if (requestView === 'pending') {
            setToast({ message: APPROVAL_COPY.requestCancelled });
          } else {
            setCancelledToast(true);
          }
        }}
      />
      <CancelGatheringSheet
        visible={cancelGatheringOpen}
        activityId={activityId}
        onClose={() => setCancelGatheringOpen(false)}
        onCancelled={() => {
          setCancelGatheringOpen(false);
          setToast({ message: CANCEL_COPY.successToast });
        }}
        onStale={(message) => {
          setCancelGatheringOpen(false);
          setToast({ message, error: true });
        }}
      />
      {askSheet ? (
        <Portal>
          <Modal
            visible
            onDismiss={() => setAskSheet(null)}
            style={styles.sheetWrapper}
            contentContainerStyle={styles.sheetModal}
          >
            <WhosComingSheet
              response={askSheet}
              mode={askMode}
              ageRange={activity}
              subtitle={activity.title}
              pending={askPending}
              error={askError}
              onCancelRequest={() => setAskSheet(null)}
              onFamilyAdded={() => void fetchWhosComing(activityId).then(setAskSheet).catch(() => undefined)}
              onConfirm={(payload) => void sendRequest(payload)}
            />
          </Modal>
        </Portal>
      ) : null}
      {cancelledToast ? <Toast message={GOING_COPY.cancelled} autoDismissMs={4000} onDismiss={() => setCancelledToast(false)} /> : null}
      {toast ? (
        <Toast
          message={toast.message}
          icon={toast.error ? 'alert-circle-outline' : 'check-circle'}
          autoDismissMs={toast.error ? 5000 : 4000}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </AppScrollView>
  );
};

/** Guest banner for a request that is waiting, declined or closed (frames 48, 50, 52, 68). */
const RequestBanner = ({ view, note }: { view: GuestRequestView; note: string | null }) => {
  const closed = view === 'pendingClosed';
  const declined = view === 'declined' || view === 'declinedClosed';
  const eyebrow = view === 'pending' ? APPROVAL_COPY.pendingEyebrow : null;
  const title = closed ? APPROVAL_COPY.closedTitle : declined ? APPROVAL_COPY.declinedTitle : APPROVAL_COPY.pendingTitle;
  const body = closed ? APPROVAL_COPY.closedBody : declined ? APPROVAL_COPY.declinedBody : APPROVAL_COPY.pendingBody;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <MaterialCommunityIcons
        name={closed || declined ? 'lock-outline' : 'clock-outline'}
        size={22}
        color={closed || declined ? '#5b5551' : appColors.primary}
      />
      <View style={styles.bannerCopy}>
        {eyebrow ? <Text style={styles.bannerEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerBody}>{body}</Text>
        {declined && note ? (
          <View style={styles.noteBlock} testID="decline-note">
            <Text style={styles.bannerEyebrow}>{APPROVAL_COPY.declinedNoteLabel}</Text>
            <Text style={styles.noteQuote}>{`\u201C${note}\u201D`}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  coverCancelled: { opacity: 0.4 },
  fullNotice: { fontFamily: appTypography.bodySemibold, fontSize: 14, color: '#8a0a1f' },
  mutedText: { color: '#7a7572' },
  struck: { textDecorationLine: 'line-through', color: '#7a7572' },
  banner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#f1ecea', borderRadius: radii.list, padding: 14 },
  bannerCopy: { flex: 1, gap: 2 },
  bannerEyebrow: { fontFamily: appTypography.bodySemibold, fontSize: 12, letterSpacing: 0.4, color: appColors.mutedInk, textTransform: 'uppercase' },
  bannerTitle: { fontFamily: appTypography.bodySemibold, fontSize: 16, lineHeight: 22, color: appColors.ink },
  bannerBody: { fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, color: appColors.ink },
  bannerMeta: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  noteBlock: { marginTop: 10, gap: 4, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: appColors.primary },
  noteQuote: { fontFamily: appTypography.heading, fontStyle: 'italic', fontSize: 16, lineHeight: 22, color: appColors.ink },
  helperCaption: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  cancelledRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cancelledPill: { minWidth: 140 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: appColors.white, borderRadius: radii.list, padding: 14, minHeight: 56 },
  requestsCopy: { flex: 1, gap: 2 },
  requestsTitle: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  newBadge: { backgroundColor: appColors.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  newBadgeText: { color: '#ffffff', fontFamily: appTypography.bodySemibold, fontSize: 12 },
  cancelBlock: { gap: 6, marginTop: 8 },
  helperText: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk, textAlign: 'center' },
  container: { padding: 20, gap: 10, paddingBottom: 48 },
  cover: { width: '100%', height: 180, borderRadius: radii.card, backgroundColor: '#c4b2a8' },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: appColors.primarySoft,
    color: appColors.primary,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontFamily: appTypography.bodySemibold,
    maxWidth: '100%',
  },
  title: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 36, color: appColors.ink },
  meta: { fontFamily: appTypography.bodyRegular, color: appColors.mutedInk, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: appTypography.bodyRegular, color: appColors.ink, fontSize: 15, lineHeight: 22 },
  section: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.ink, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: appColors.background },
  pastLabel: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.mutedInk },
  statusChip: { alignSelf: 'flex-start', backgroundColor: appColors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusChipText: { color: '#f6f1ee', fontFamily: appTypography.bodySemibold, fontSize: 13 },
  alignStart: { alignSelf: 'flex-start' },
  pillRow: { flexDirection: 'row', gap: 12 },
  pillEqual: { flex: 1 },
  add: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  error: { color: appColors.danger, fontFamily: appTypography.bodyRegular },
  sheetWrapper: { marginBottom: 0 },
  sheetModal: {
    backgroundColor: 'transparent',
    marginHorizontal: 0,
    marginBottom: 0,
    justifyContent: 'flex-end',
  },
});
