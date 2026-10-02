import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { FlatList, Image, Linking, Modal, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { ActionSheet, ReportSheet } from '@components/foyer/SafetySheets';
import { PillButton, SheetButtons, Toast } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, MEMBER_COPY, PHOTO_COPY } from '@constants/foyerCopy';
import { photosForSelection, toastForOutcome, type DownloadOutcome, type DownloadToast } from '@foyer/downloads';
import { ensureAddOnlyPermission, savePhotosToLibrary } from '@foyer/photoDownload';
import { hasEventStarted, isGoingRsvp } from '@foyer/rsvp';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { fetchActivity } from '@services/activityService';
import { PhotoDownloadUnavailableError, type DownloadablePhoto } from '@services/foyerService';
import { canReport, submitReport, type ReportTarget } from '@services/reportAdapter';
import { appColors, appTypography } from '@theme/index';

/** `ownerId` is only present once the backend exposes who uploaded a photo; without it Report is not offered (gap). */
type GalleryPhoto = { id: number | null; url: string; ownerId: number | string | null };

type PhotoPayload = {
  id?: number;
  url: string;
  uploaded_by_id?: number | string | null;
  user_id?: number | string | null;
  owner_id?: number | string | null;
};

const GUTTER = 2;
const COLUMNS = 3;

export const toastMessage = (toast: DownloadToast): string => {
  switch (toast.kind) {
    case 'saved':
      return PHOTO_COPY.savedToast(toast.saved);
    case 'cancelled':
      return PHOTO_COPY.cancelledToast(toast.saved, toast.total);
    case 'partial':
      return PHOTO_COPY.partialToast(toast.saved, toast.total);
    default:
      return PHOTO_COPY.failedAll;
  }
};

/** Event photo gallery: 3-column grid, selection mode, viewer, and Download / Download all. */
export const PhotoGalleryScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'PhotoGallery'>>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const activityId = route.params.activityId;
  const activityQuery = useQuery({ queryKey: ['foyer-gathering', activityId], queryFn: () => fetchActivity(activityId) });
  const activity = activityQuery.data;

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; retry?: () => void; sticky: boolean } | null>(null);
  const [denied, setDenied] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportSheet, setReportSheet] = useState<'menu' | 'report' | 'block' | null>(null);
  const cancelled = useRef(false);
  const lastOutcome = useRef<DownloadOutcome | null>(null);

  const photos: GalleryPhoto[] = (activity?.photos ?? [])
    .filter((photo): photo is PhotoPayload => Boolean(photo.url))
    .map((photo) => ({
      id: photo.id ?? null,
      url: photo.url,
      ownerId: photo.uploaded_by_id ?? photo.user_id ?? photo.owner_id ?? null,
    }));

  const hostId = activity && typeof activity.host === 'object' ? activity.host.id : null;
  const isHost = hostId != null && user?.id != null && String(hostId) === String(user.id);
  const isGoing = isGoingRsvp(activity?.my_rsvp);
  const churchAdmin = Boolean(activity?.host_kind === 'church' && user?.isChurchAdmin);
  // Attendees (host included) get download controls; everyone else sees none.
  const canDownload = Boolean((isHost || isGoing || churchAdmin) && photos.some((photo) => photo.id != null));
  const size = Math.floor((width - GUTTER * (COLUMNS - 1)) / COLUMNS);

  const run = async (options: { onlyIds?: number[]; resume?: DownloadOutcome | null }) => {
    const permission = await ensureAddOnlyPermission();
    if (permission !== 'granted') {
      setDenied(true);
      return;
    }
    cancelled.current = false;
    setToast(null);
    setProgress({ done: options.resume?.saved ?? 0, total: options.resume?.total ?? options.onlyIds?.length ?? photos.length });
    try {
      const outcome = await savePhotosToLibrary({
        activityId,
        onlyIds: options.onlyIds,
        isCancelled: () => cancelled.current,
        onProgress: (done, total) => setProgress({ done, total }),
        resume: options.resume
          ? { remaining: options.resume.remaining, alreadySaved: options.resume.saved, total: options.resume.total }
          : undefined,
      });
      lastOutcome.current = outcome;
      const result = toastForOutcome(outcome);
      setToast({
        message: toastMessage(result),
        retry: result.kind === 'saved' ? undefined : () => void run({ resume: outcome }),
        sticky: result.kind !== 'saved',
      });
      if (result.kind === 'saved') {
        setTimeout(() => setToast((current) => (current && !current.sticky ? null : current)), 4000);
      }
      setSelecting(false);
      setSelected(new Set());
    } catch (error) {
      setToast({
        message: error instanceof PhotoDownloadUnavailableError ? COMMON_COPY.unavailable : PHOTO_COPY.failedAll,
        sticky: true,
        retry: () => void run(options),
      });
    } finally {
      setProgress(null);
    }
  };

  const toggle = (id: number | null) => {
    if (id == null) {
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedIds = photosForSelection(
    photos.filter((photo) => photo.id != null) as unknown as DownloadablePhoto[],
    selected,
  ).map((photo) => photo.id);

  const viewerPhoto = viewerIndex != null ? photos[viewerIndex] : null;
  const viewerPhotoTarget: ReportTarget | null = viewerPhoto
    ? { type: 'photo', ownerId: viewerPhoto.ownerId, photoId: viewerPhoto.id, activityId }
    : null;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => (selecting ? (setSelecting(false), setSelected(new Set())) : navigation.goBack())}
          style={styles.barButton}
        >
          <Text style={styles.barText}>{selecting ? COMMON_COPY.cancel : COMMON_COPY.back}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.barTitle}>
          {PHOTO_COPY.galleryTitle(photos.length)}
        </Text>
        {canDownload && !selecting ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={PHOTO_COPY.downloadAll}
            disabled={progress != null}
            onPress={() => void run({})}
            style={styles.barButton}
          >
            <Text style={styles.barText}>{PHOTO_COPY.downloadAll}</Text>
          </Pressable>
        ) : (
          <View style={styles.barButton} />
        )}
      </View>

      <FlatList
        data={photos}
        numColumns={COLUMNS}
        keyExtractor={(photo, index) => `${photo.id ?? 'x'}-${index}`}
        columnWrapperStyle={{ gap: GUTTER }}
        ItemSeparatorComponent={() => <View style={{ height: GUTTER }} />}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item, index }) => {
          const isSelected = item.id != null && selected.has(item.id);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Photo ${index + 1} of ${photos.length}`}
              onPress={() => (selecting ? toggle(item.id) : setViewerIndex(index))}
              onLongPress={() => {
                if (canDownload) {
                  setSelecting(true);
                  toggle(item.id);
                }
              }}
              style={[{ width: size, height: size }, isSelected ? styles.thumbSelected : null]}
            >
              <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%' }} />
              {selecting ? (
                <View style={[styles.circle, isSelected ? styles.circleOn : null]}>
                  {isSelected ? <MaterialCommunityIcons name="check" size={16} color="#f6f1ee" /> : null}
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      {selecting ? (
        <View style={styles.selectionBar}>
          <PillButton
            label={PHOTO_COPY.downloadSelected(selectedIds.length)}
            disabled={selectedIds.length === 0 || progress != null}
            onPress={() => void run({ onlyIds: selectedIds })}
          />
        </View>
      ) : canDownload ? (
        <View style={styles.selectionBar}>
          <PillButton label={PHOTO_COPY.select} variant="outline" onPress={() => setSelecting(true)} />
        </View>
      ) : null}

      <ActionSheet
        visible={reportSheet === 'menu'}
        onClose={() => setReportSheet(null)}
        rows={[
          ...(canDownload && reportTarget?.type === 'photo' && reportTarget.photoId != null
            ? [
                {
                  label: PHOTO_COPY.download,
                  onPress: () => {
                    setReportSheet(null);
                    void run({ onlyIds: [reportTarget.photoId as number] });
                  },
                  testID: 'photo-download',
                },
              ]
            : []),
          { label: MEMBER_COPY.reportPhoto, onPress: () => setReportSheet('report'), testID: 'photo-report-row' },
        ]}
      />
      <ReportSheet
        visible={reportSheet === 'report'}
        title={MEMBER_COPY.reportPhoto}
        lead={MEMBER_COPY.reportPhotoLead}
        name={MEMBER_COPY.thisPerson}
        onClose={() => setReportSheet(null)}
        onSubmit={(payload) => (reportTarget ? submitReport(reportTarget, payload) : Promise.resolve())}
        onSent={() => {
          setReportSheet(null);
          setToast({ message: MEMBER_COPY.reportSent, sticky: false });
        }}
      />
      <Modal visible={viewerPhoto != null} animationType="fade" onRequestClose={() => setViewerIndex(null)}>
        <View style={styles.viewer}>
          <View style={styles.viewerBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setViewerIndex(null)} style={styles.barButton}>
              <MaterialCommunityIcons name="close" size={24} color="#f6f1ee" />
            </Pressable>
            <Text style={styles.viewerTitle}>
              {viewerIndex != null ? PHOTO_COPY.viewerPosition(viewerIndex + 1, photos.length) : ''}
            </Text>
            {viewerPhoto && viewerPhotoTarget && canReport(viewerPhotoTarget) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={MEMBER_COPY.reportOrBlock}
                onPress={() => {
                  // Close the viewer first: a sheet cannot open over another Modal reliably.
                  setReportTarget(viewerPhotoTarget);
                  setViewerIndex(null);
                  setReportSheet('menu');
                }}
                style={styles.barButton}
                testID="photo-report"
              >
                <MaterialCommunityIcons name="dots-horizontal" size={24} color="#f6f1ee" />
              </Pressable>
            ) : (
              <View style={styles.barButton} />
            )}
          </View>
          {viewerPhoto ? <Image source={{ uri: viewerPhoto.url }} resizeMode="contain" style={styles.viewerImage} /> : null}
          <View style={styles.viewerFooter}>
            {viewerIndex != null && viewerIndex > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" onPress={() => setViewerIndex(viewerIndex - 1)} style={styles.barButton}>
                <MaterialCommunityIcons name="chevron-left" size={28} color="#f6f1ee" />
              </Pressable>
            ) : (
              <View style={styles.barButton} />
            )}
            {canDownload && viewerPhoto?.id != null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={PHOTO_COPY.saveToPhotos}
                disabled={progress != null}
                onPress={() => void run({ onlyIds: [viewerPhoto.id as number] })}
                style={styles.saveButton}
              >
                <View style={styles.saveCircle}>
                  <MaterialCommunityIcons name="download" size={24} color="#f6f1ee" />
                </View>
                <Text style={styles.saveLabel}>{PHOTO_COPY.saveToPhotos}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            {viewerIndex != null && viewerIndex < photos.length - 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Next photo" onPress={() => setViewerIndex(viewerIndex + 1)} style={styles.barButton}>
                <MaterialCommunityIcons name="chevron-right" size={28} color="#f6f1ee" />
              </Pressable>
            ) : (
              <View style={styles.barButton} />
            )}
          </View>
          {toast ? (
            <Toast
              message={toast.message}
              icon="information"
              action={toast.retry ? { label: COMMON_COPY.retry, onPress: toast.retry } : undefined}
              onDismiss={() => setToast(null)}
            />
          ) : null}
        </View>
      </Modal>

      <FoyerSheet
        visible={progress != null}
        onDismiss={() => {
          cancelled.current = true;
        }}
        footer={
          <SheetButtons>
            <PillButton
              label={COMMON_COPY.cancel}
              variant="outline"
              onPress={() => {
                cancelled.current = true;
              }}
            />
          </SheetButtons>
        }
      >
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          {progress ? PHOTO_COPY.progressTitle(progress.done, progress.total) : ''}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` },
            ]}
          />
        </View>
        <Text style={styles.sheetBody}>{PHOTO_COPY.progressHelper}</Text>
      </FoyerSheet>

      <FoyerSheet
        visible={denied}
        onDismiss={() => setDenied(false)}
        footer={
          <SheetButtons>
            <PillButton
              label={COMMON_COPY.openSettings}
              onPress={() => {
                setDenied(false);
                void Linking.openSettings();
              }}
            />
            <PillButton label={COMMON_COPY.notNow} variant="outline" onPress={() => setDenied(false)} />
          </SheetButtons>
        }
      >
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          {PHOTO_COPY.deniedTitle}
        </Text>
        <Text style={styles.sheetBody}>{PHOTO_COPY.deniedBody}</Text>
      </FoyerSheet>

      {toast && viewerPhoto == null ? (
        <Toast
          message={toast.message}
          icon={toast.sticky ? 'information' : 'check-circle'}
          action={toast.retry ? { label: COMMON_COPY.retry, onPress: toast.retry } : undefined}
          onDismiss={toast.sticky ? () => setToast(null) : undefined}
          bottom={selecting || canDownload ? 96 : 24}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 12 },
  barButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  barText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  barTitle: { flex: 1, textAlign: 'center', fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  gridContent: { paddingBottom: 120 },
  thumbSelected: { borderWidth: 3, borderColor: appColors.primary },
  circle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f6f1ee',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOn: { backgroundColor: appColors.primary, borderColor: appColors.primary },
  selectionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, backgroundColor: appColors.background },
  viewer: { flex: 1, backgroundColor: '#0f0c0d' },
  viewerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 48 },
  viewerTitle: { flex: 1, textAlign: 'center', color: '#f6f1ee', fontFamily: appTypography.bodySemibold, fontSize: 16 },
  viewerImage: { flex: 1, width: '100%' },
  viewerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 36 },
  saveButton: { alignItems: 'center', gap: 6, minHeight: 72, minWidth: 96 },
  saveCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: appColors.primary, alignItems: 'center', justifyContent: 'center' },
  saveLabel: { color: '#f6f1ee', fontFamily: appTypography.bodySemibold, fontSize: 13 },
  sheetTitle: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink },
  sheetBody: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: appColors.line, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: appColors.primary },
});
