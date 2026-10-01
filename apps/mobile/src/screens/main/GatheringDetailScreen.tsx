import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';

import { AddToCalendarSheet } from '@components/AddToCalendarSheet';
import { AppScrollView } from '@components/AppChrome';
import { RefreshControl, View } from '@components/RNCompat';
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
import { uploadGatheringPhoto } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

export const GatheringDetailScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'GatheringDetail'>>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const activityId = route.params.activityId;

  const activityQuery = useQuery({
    queryKey: ['foyer-gathering', activityId],
    queryFn: () => fetchActivity(activityId),
  });

  const uploadMutation = useMutation({
    mutationFn: async (uri: string) => {
      const compressed = await compressGatheringPhoto(uri);
      return uploadGatheringPhoto(activityId, compressed);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['foyer-gathering', activityId] });
    },
    onError: (uploadError) => setError(getErrorMessage(uploadError, 'Unable to add that photo.')),
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
  const isGoing = Boolean(
    activity?.my_rsvp &&
      (activity.my_rsvp.status === 'confirmed' || (activity.my_rsvp.people_count ?? 0) > 0),
  );
  const churchAdmin = Boolean(activity?.host_kind === 'church' && user?.isChurchAdmin);
  const canAdd = (isHost || isGoing || churchAdmin) && photoUrls.length < MAX_GATHERING_PHOTOS;

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const uri = result.assets?.[0]?.uri;
    if (result.canceled || !uri) {
      return;
    }
    uploadMutation.mutate(uri);
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
      <Text style={styles.meta}>{gatheringLocationLabel(activity.location)}</Text>
      {activity.description ? <Text style={styles.body}>{activity.description}</Text> : null}
      <Text style={styles.meta}>Hosted by {hostDisplayName(activity)}</Text>
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

      <Text style={styles.section}>Photos</Text>
      <View style={styles.grid}>
        {photoUrls.map((url) => (
          <Image key={url} source={{ uri: url }} style={styles.thumb} />
        ))}
      </View>
      {canAdd ? (
        <Pressable accessibilityRole="button" onPress={() => void pickPhoto()} disabled={uploadMutation.isPending}>
          <Text style={styles.add}>
            {uploadMutation.isPending ? 'Adding photo…' : `Add a photo · ${photoUrls.length} of ${MAX_GATHERING_PHOTOS}`}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.meta}>
          {photoUrls.length >= MAX_GATHERING_PHOTOS
            ? 'This gathering already has 8 photos.'
            : 'Photos can be added by the host and people who are going.'}
        </Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
