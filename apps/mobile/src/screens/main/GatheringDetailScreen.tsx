import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';

import { AddToCalendarSheet } from '@components/AddToCalendarSheet';
import { AppScrollView } from '@components/AppChrome';
import { CancelRsvpSheet } from '@components/foyer/CancelRsvpSheet';
import { HostAttendeesCard } from '@components/foyer/HostAttendeesCard';
import { PastAttendeesCard } from '@components/foyer/PastAttendeesCard';
import { PhotoUploadSheet } from '@components/foyer/PhotoUploadSheet';
import { PillButton, Toast } from '@components/foyer/ui';
import { RefreshControl, View } from '@components/RNCompat';
import { ATTENDEE_COPY, GOING_COPY, PHOTO_COPY } from '@constants/foyerCopy';
import { buildPastAttendees, isHostAttendeeView } from '@foyer/attendees';
import { formatGatheringWhen } from '@foyer/dates';
import { canCancelRsvp, canSeeChat, hasEventStarted, isGoingRsvp } from '@foyer/rsvp';
import { MAX_GATHERING_PHOTOS, compressGatheringPhoto } from '@foyer/photos';
import {
  audienceChipLabel,
  coverPhotoUrl,
  gatheringLocationLabel,
  goingCountLabel,
  hostDisplayName,
} from '@foyer/logic';
import { gatheringCalendarUrls, openCalendarUrl } from '@foyer/openCalendar';
import { calendarEventSummary } from '@shared/calendarLinks';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { fetchActivity } from '@services/activityService';
import { fetchAttendees, uploadGatheringPhoto } from '@services/foyerService';
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
  const navigation = useNavigation<any>();
  const activityId = route.params.activityId;

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
  const showChat = canSeeChat({ isHost, isGoing, isChurchAdminOfChurchEvent: churchAdmin });
  const showCancel = canCancelRsvp({ isHost, isGoing, time: activity?.time });

  // Host: households. Going guest after the event starts: names. Anyone else: nothing (403 -> null).
  const attendeesQuery = useQuery({
    queryKey: ['foyer-attendees', activityId],
    queryFn: () => fetchAttendees(activityId),
    enabled: Boolean(activity) && (isHost || (isGoing && started)),
    retry: false,
  });
  const hostView = isHost && isHostAttendeeView(attendeesQuery.data ?? null);
  const pastAttendees = started && !isHost ? buildPastAttendees(attendeesQuery.data ?? null) : [];

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to add a photo.');
      return;
    }
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
      {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : <View style={styles.cover} />}
      <Text style={styles.chip}>{audienceChipLabel(activity)}</Text>
      <Text style={styles.title}>{activity.title}</Text>
      <Text style={styles.meta}>{goingCountLabel(activity.going_count ?? activity.participant_count ?? 0)}</Text>
      {activity.time ? (
        <Text style={styles.meta}>
          {formatGatheringWhen(activity.time)}
        </Text>
      ) : null}
      {started ? <Text style={styles.pastLabel}>{ATTENDEE_COPY.pastLabel}</Text> : null}
      {isGoing ? (
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>{GOING_COPY.title}</Text>
        </View>
      ) : null}
      {showCancel ? (
        <PillButton label={GOING_COPY.cancelRsvp} variant="text" onPress={() => setCancelOpen(true)} style={styles.alignStart} />
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
            onPress={() => navigation.navigate('Tabs', { screen: 'Chat' })}
          />
        ) : null}
      </View>
      <Text style={styles.meta}>{gatheringLocationLabel(activity.location)}</Text>
      {activity.description ? <Text style={styles.body}>{activity.description}</Text> : null}
      <Text style={styles.meta}>Hosted by {hostDisplayName(activity)}</Text>
      {hostView && attendeesQuery.data ? <HostAttendeesCard data={attendeesQuery.data} /> : null}
      {pastAttendees.length > 0 ? (
        <PastAttendeesCard
          attendees={pastAttendees}
          onOpen={(userId) => navigation.navigate('MemberProfile', { userId })}
        />
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Add to calendar" onPress={() => setShowCalendar(true)}>
        <Text style={styles.add}>Add to calendar</Text>
      </Pressable>
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
        onClose={() => setCancelOpen(false)}
        onCancelled={() => {
          setCancelOpen(false);
          setCancelledToast(true);
        }}
      />
      {cancelledToast ? <Toast message={GOING_COPY.cancelled} onDismiss={() => setCancelledToast(false)} /> : null}
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
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
