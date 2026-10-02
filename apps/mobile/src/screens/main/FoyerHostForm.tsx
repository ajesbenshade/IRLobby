import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoyerHeader } from '@components/FoyerHeader';
import { DatePickerSheet, PickerField } from '@components/foyer/DatePickerSheet';
import { TimePickerSheet } from '@components/foyer/TimePickerSheet';
import { ScrollView, View } from '@components/RNCompat';
import { MapPickerSheet } from '@components/foyer/MapPickerSheet';
import { PillButton } from '@components/foyer/ui';
import {
  CALENDAR_ADDRESS_WARNING,
  parseCapacity,
  type AudienceGender,
  type HostKind,
} from '@foyer/logic';
import {
  DEFAULT_START_MINUTES,
  endTimeSlots,
  formatDayLong,
  formatTimeOfDay,
  hostDayLimits,
  startTimeSlots,
  toIsoDateTime,
  type DayValue,
} from '@foyer/dates';
import { compressGatheringPhoto } from '@foyer/photos';
import { APPROVAL_COPY, HOST_FORM_COPY, MAP_COPY, PICKER_COPY } from '@constants/foyerCopy';
import { parseTurnOffFallback } from '@foyer/approval';
import { useDetectedCapabilities, isRequireApprovalEnabled } from '@foyer/capabilities';
import {
  approvalCardVisible,
  approvalPayload,
  canPostGathering,
  hostFormValuesFromActivity,
  shouldBlockTurnOff,
} from '@foyer/hostForm';
import { useAuth } from '@hooks/useAuth';
import { useTabScreenBottomPadding } from '@navigation/tabBarLayout';
import type { MainStackParamList } from '@navigation/types';
import { createActivity, fetchActivity, updateActivity } from '@services/activityService';
import { uploadGatheringPhoto } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

type FoyerHostFormProps = {
  activityId?: number | string;
};

export const FoyerHostForm = ({ activityId }: FoyerHostFormProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuth();
  // Host is a tab (the floating bar covers the bottom); Edit is a stack screen with no bar.
  const tabBottomPadding = useTabScreenBottomPadding();
  const isEditing = Boolean(activityId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [day, setDay] = useState<DayValue | null>(null);
  const [startMinutes, setStartMinutes] = useState<number | null>(null);
  const [endMinutes, setEndMinutes] = useState<number | null>(null);
  const [picker, setPicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [attemptedPost, setAttemptedPost] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [audience, setAudience] = useState<AudienceGender>('everyone');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [listOnCalendar, setListOnCalendar] = useState(false);
  const [hostAsChurch, setHostAsChurch] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requireApproval, setRequireApproval] = useState(false);
  const [allowRerequest, setAllowRerequest] = useState(false);

  // Require approval shows only when the backend supports it (field detection or FEATURES switch).
  useDetectedCapabilities();
  const approvalEnabled = isRequireApprovalEnabled();
  const showApprovalCard = approvalCardVisible({ enabled: approvalEnabled, listOnCalendar, hostAsChurch });

  // Edit: start from what was posted (the form used to open blank and would send blanks).
  const existingQuery = useQuery({
    queryKey: ['foyer-gathering', activityId],
    queryFn: () => fetchActivity(activityId as number | string),
    enabled: isEditing,
  });
  const existing = existingQuery.data;
  const prefilled = useRef(false);
  useEffect(() => {
    if (!existing || prefilled.current) {
      return;
    }
    prefilled.current = true;
    const values = hostFormValuesFromActivity(existing, approvalEnabled);
    setTitle(values.title);
    setDescription(values.description);
    setPlace(values.place);
    setDay(values.day);
    setStartMinutes(values.startMinutes);
    setEndMinutes(values.endMinutes);
    setCapacity(values.capacity);
    setAudience(values.audience);
    setAgeMin(values.ageMin);
    setAgeMax(values.ageMax);
    setListOnCalendar(values.listOnCalendar);
    setHostAsChurch(values.hostAsChurch);
    setRequireApproval(values.requireApproval);
    setAllowRerequest(values.allowRerequest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const reviewRequests = () => {
    if (activityId) {
      navigation.navigate('Requests', { activityId });
    }
  };

  const showTurnOffBlocked = (count: number) => {
    Alert.alert(APPROVAL_COPY.turnOffTitle, APPROVAL_COPY.turnOffBody(count), [
      { text: APPROVAL_COPY.reviewRequests, onPress: reviewRequests },
      { text: APPROVAL_COPY.notNow, style: 'cancel' },
    ]);
  };

  const toggleRequireApproval = (next: boolean) => {
    if (shouldBlockTurnOff({ wasOn: existing?.requires_approval === true, turningOff: !next, pendingCount: existing?.pending_count })) {
      // Client check first: the switch stays on and the host is sent to the deck.
      showTurnOffBlocked(Number(existing?.pending_count ?? 0));
      return;
    }
    setRequireApproval(next);
    if (!next) {
      setAllowRerequest(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const capacityResult = parseCapacity(capacity);
      if (!capacityResult.ok) {
        throw new Error(capacityResult.message);
      }
      const payload = {
        title: title.trim(),
        description: description.trim(),
        location: place.trim(),
        latitude: coords?.latitude ?? 0,
        longitude: coords?.longitude ?? 0,
        time: day && startMinutes != null ? toIsoDateTime(day, startMinutes) : '',
        end_time: day && endMinutes != null ? toIsoDateTime(day, endMinutes) : undefined,
        capacity: capacityResult.capacity,
        audience_gender: audience,
        age_min: ageMin.trim() ? Number(ageMin) : null,
        age_max: ageMax.trim() ? Number(ageMax) : null,
        list_on_church_calendar: listOnCalendar,
        host_kind: (hostAsChurch ? 'church' : 'person') as HostKind,
        // Only when Require approval is enabled; nothing here ever writes the legacy field otherwise.
        ...approvalPayload({
          enabled: approvalEnabled,
          listOnCalendar,
          hostAsChurch,
          state: { requireApproval, allowRerequest },
        }),
      };
      const saved = isEditing && activityId
        ? await updateActivity(activityId, payload as never)
        : await createActivity(payload as never);
      if (photoUri) {
        const compressed = await compressGatheringPhoto(photoUri);
        await uploadGatheringPhoto(saved.id, compressed);
      }
      return saved;
    },
    onSuccess: () => {
      navigation.navigate('Tabs', { screen: 'Activity' });
    },
    onError: (saveError) => {
      const message = getErrorMessage(saveError, HOST_FORM_COPY.postFailed);
      // Server fallback for "turn off with waiting requests": same alert as the client check.
      const waiting = parseTurnOffFallback(message);
      if (waiting != null) {
        setRequireApproval(true);
        showTurnOffBlocked(waiting);
        return;
      }
      setError(message);
    },
  });

  const pickPhoto = async () => {
    // The system photo picker needs no library permission (add-only access is used for saving).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const submit = () => {
    const capacityResult = parseCapacity(capacity);
    if (!capacityResult.ok) {
      setError(capacityResult.message);
      return;
    }
    setAttemptedPost(true);
    if (!day || startMinutes == null) {
      return;
    }
    if (!title.trim() || !place.trim()) {
      setError(HOST_FORM_COPY.missingTitlePlace);
      return;
    }
    setError(null);
    saveMutation.mutate();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.topButton}>
          <Text maxFontSizeMultiplier={1.4} style={styles.topAction}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>Host a gathering</Text>
        {/* Spacer keeps the title centred; the only Post action is the sticky footer pill. */}
        <View style={styles.topButton} />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FoyerHeader />
        <Pressable accessibilityRole="button" accessibilityLabel="Add a cover photo" onPress={() => void pickPhoto()} style={styles.cover}>
          <Text style={styles.coverTitle}>{photoUri ? 'Cover photo selected' : 'Add a cover photo'}</Text>
          <Text style={styles.helper}>Choose from library or take a photo</Text>
        </Pressable>

        <Field label="Title" value={title} onChange={setTitle} placeholder="Women's Fall Brunch" />
        <Field label="Description" value={description} onChange={setDescription} multiline placeholder="Egg casseroles, apple crisp, and good conversation." />
        <Field label="Place" value={place} onChange={setPlace} placeholder="Fellowship Hall, Franconia Mennonite Church" />
        <PillButton label={MAP_COPY.chooseOnMap} variant="outline" icon="map-marker-outline" onPress={() => setMapOpen(true)} />
        <MapPickerSheet
          visible={mapOpen}
          onCancel={() => setMapOpen(false)}
          onChoose={(chosen) => {
            setCoords({ latitude: chosen.latitude, longitude: chosen.longitude });
            if (!place.trim()) {
              setPlace(chosen.label);
            }
            setMapOpen(false);
          }}
        />
        <Text style={styles.sectionLabel}>{PICKER_COPY.when}</Text>
        <PickerField
          label={PICKER_COPY.date}
          value={day ? formatDayLong(day) : null}
          placeholder="Choose a date"
          icon="calendar-month-outline"
          error={attemptedPost && !day ? PICKER_COPY.chooseDate : null}
          onPress={() => setPicker('date')}
          testID="host-date-field"
        />
        <PickerField
          label={PICKER_COPY.startTime}
          value={startMinutes != null ? formatTimeOfDay(startMinutes) : null}
          placeholder="Choose a start time"
          icon="clock-outline"
          error={attemptedPost && startMinutes == null ? PICKER_COPY.chooseStart : null}
          onPress={() => setPicker('start')}
          testID="host-start-field"
        />
        <PickerField
          label={PICKER_COPY.ends}
          value={endMinutes != null ? formatTimeOfDay(endMinutes) : PICKER_COPY.noEndTime}
          icon="clock-end"
          onPress={() => setPicker('end')}
          testID="host-end-field"
        />
        <DatePickerSheet
          mode="day"
          visible={picker === 'date'}
          title={PICKER_COPY.dayTitle}
          value={day}
          limits={hostDayLimits()}
          onCancel={() => setPicker(null)}
          onDone={(value) => {
            setDay(value);
            setPicker(null);
          }}
        />
        <TimePickerSheet
          visible={picker === 'start'}
          title={PICKER_COPY.startTimeTitle}
          slots={startTimeSlots(endMinutes)}
          value={startMinutes}
          defaultValue={endMinutes != null && endMinutes <= DEFAULT_START_MINUTES ? undefined : DEFAULT_START_MINUTES}
          onCancel={() => setPicker(null)}
          onDone={(value) => {
            setStartMinutes(value);
            setPicker(null);
          }}
        />
        <TimePickerSheet
          visible={picker === 'end'}
          title={PICKER_COPY.endTimeTitle}
          slots={endTimeSlots(startMinutes)}
          value={endMinutes}
          allowNone
          onCancel={() => setPicker(null)}
          onDone={(value) => {
            setEndMinutes(value);
            setPicker(null);
          }}
        />
        <Field
          label="Capacity"
          value={capacity}
          onChange={setCapacity}
          placeholder="No limit"
          keyboardType="number-pad"
          helper="Leave blank for no limit. Up to 500."
        />

        <Text style={styles.label}>Audience</Text>
        <View style={styles.segment}>
          {([
            ['everyone', 'Everyone'],
            ['men', 'Men'],
            ['women', 'Women'],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: audience === value }}
              onPress={() => setAudience(value)}
              style={[styles.segmentItem, audience === value ? styles.segmentOn : null]}
            >
              <Text style={[styles.segmentText, audience === value ? styles.segmentTextOn : null]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Age range</Text>
        <View style={styles.ageRow}>
          <View style={styles.ageCell}>
            <Field label="Min" value={ageMin} onChange={setAgeMin} placeholder="18" keyboardType="number-pad" />
          </View>
          <View style={styles.ageCell}>
            <Field label="Max" value={ageMax} onChange={setAgeMax} placeholder="Any" keyboardType="number-pad" />
          </View>
        </View>
        <Text style={styles.helper}>Leave max blank for no upper limit. Children in a household can be added if they fit the range.</Text>

        <CheckRow
          label="Post to the church website calendar"
          value={listOnCalendar}
          onChange={setListOnCalendar}
        />
        <View style={styles.warn}>
          <Text style={styles.warnText}>{CALENDAR_ADDRESS_WARNING}</Text>
        </View>

        {showApprovalCard ? (
          <View style={styles.approvalCard}>
            <CheckRow label={APPROVAL_COPY.toggleLabel} value={requireApproval} onChange={toggleRequireApproval} />
            <Text style={styles.helper}>{APPROVAL_COPY.toggleHelper}</Text>
            {requireApproval ? (
              <>
                <View style={styles.divider} />
                <CheckRow label={APPROVAL_COPY.askAgainLabel} value={allowRerequest} onChange={setAllowRerequest} />
                <Text style={styles.helper}>{APPROVAL_COPY.askAgainHelper}</Text>
              </>
            ) : null}
          </View>
        ) : null}
        {showApprovalCard && requireApproval ? <Text style={styles.helper}>{APPROVAL_COPY.guestLine}</Text> : null}

        {user?.isChurchAdmin ? (
          <View style={styles.admin}>
            <Text style={styles.adminLabel}>Admin only</Text>
            <CheckRow
              label="Host as Franconia Mennonite Church"
              value={hostAsChurch}
              onChange={setHostAsChurch}
            />
            <Text style={styles.helper}>The church is shown as the host of this gathering.</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.stickyFooter, tabBottomPadding != null ? { paddingBottom: tabBottomPadding } : null]}>
        <PillButton
          label={APPROVAL_COPY.post}
          loadingLabel={APPROVAL_COPY.posting}
          loading={saveMutation.isPending}
          disabled={!canPostGathering({ title, day })}
          onPress={submit}
          testID="host-post-button"
        />
        <Text style={styles.footer}>Chat opens for people who are going.</Text>
      </View>
    </View>
  );
};

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  helper,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={appColors.softInk}
      multiline={multiline}
      keyboardType={keyboardType}
      style={[styles.input, multiline ? styles.inputMulti : null]}
    />
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
  </View>
);

const CheckRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) => (
  <View style={styles.checkRow}>
    <Text style={styles.checkLabel}>{label}</Text>
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: appColors.line, true: appColors.primary }}
      thumbColor={appColors.white}
    />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: appColors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: appColors.background,
  },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: appTypography.bodySemibold, fontSize: 17, lineHeight: 24, color: appColors.ink },
  topButton: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
  topAction: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.primary },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  cover: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  coverTitle: { fontFamily: appTypography.bodySemibold, color: appColors.primary, fontSize: 16, textAlign: 'center' },
  field: { gap: 6 },
  label: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.ink },
  sectionLabel: { fontFamily: appTypography.bodySemibold, fontSize: 11.5, letterSpacing: 0.6, color: appColors.mutedInk },
  input: {
    minHeight: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    color: appColors.ink,
    fontFamily: appTypography.bodyRegular,
  },
  inputMulti: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  helper: { fontFamily: appTypography.bodyRegular, fontSize: 12.5, color: appColors.mutedInk, lineHeight: 18 },
  segment: { flexDirection: 'row', backgroundColor: appColors.white, borderRadius: 10, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  segmentOn: { backgroundColor: appColors.primaryWash },
  segmentText: { fontFamily: appTypography.bodyMedium, color: appColors.mutedInk },
  segmentTextOn: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  ageRow: { flexDirection: 'row', gap: 12 },
  ageCell: { flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56 },
  checkLabel: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.ink },
  warn: { backgroundColor: appColors.warnBg, borderRadius: radii.list, padding: 12 },
  warnText: { color: appColors.warnText, fontFamily: appTypography.bodyRegular, fontSize: 13, lineHeight: 18 },
  admin: { borderRadius: radii.list, borderWidth: 1, borderColor: appColors.line, padding: 12, gap: 8, backgroundColor: appColors.white },
  adminLabel: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.mutedInk, textTransform: 'uppercase' },
  error: { color: appColors.danger, fontFamily: appTypography.bodyMedium },
  approvalCard: { borderRadius: radii.list, borderWidth: 1, borderColor: appColors.line, padding: 14, gap: 8, backgroundColor: appColors.white },
  divider: { height: 1, backgroundColor: appColors.line, marginVertical: 4 },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 6,
    backgroundColor: appColors.background,
    borderTopWidth: 1,
    borderTopColor: appColors.line,
  },
  footer: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 13 },
});
