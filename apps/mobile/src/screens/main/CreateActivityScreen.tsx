import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccentPill, PanelCard, SectionIntro } from '@components/AppChrome';
import { EventPhotoSlots } from '@components/EventPhotoSlots';
import { FoyerHeader } from '@components/FoyerHeader';
import { ScrollView, View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { Chip } from '@components/ui/Chip';
import { Field } from '@components/ui/Field';
import { MAX_EVENT_PHOTOS } from '@constants/activity';
import { isTicketingUiEnabled } from '@constants/appMode';
import { config } from '@constants/config';
import {
  formatEventDateLabel,
  formatEventTimeLabel,
  hostFeePreviewCopy,
  parseTicketPrice,
  PROTOTYPE_FOOTER_HOST,
} from '@constants/tickets';
import { useAuth } from '@hooks/useAuth';
import { useTabScreenBottomPadding } from '@navigation/tabBarLayout';
import type { MainStackParamList } from '@navigation/types';
import {
  createActivity,
  fetchActivity,
  updateActivity,
} from '@services/activityService';
import type { CreateActivityPayload } from '@services/activityService';
import { fetchStripeConnectStatus } from '@services/paymentService';
import { appColors, appTypography, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';
import { imageAssetToUploadDataUrl } from '@utils/profileImages';

import {
  createEventImagePayload,
  createEventPrimaryCtaLabel,
  createEventTicketPayload,
  normalizeEventImages,
} from './createActivityForm';

type ActivityFormState = {
  title: string;
  description: string;
  location: string;
  time: string;
  endTime: string;
  capacity: string;
  latitude: string;
  longitude: string;
  tags: string;
  category: string;
  visibility: string;
  requiresApproval: boolean;
  skillLevel: string;
  ageRestriction: string;
  equipmentRequired: string;
  weatherDependent: boolean;
  isTicketed: boolean;
  ticketPrice: string;
  maxTickets: string;
  requireQrCheckIn: boolean;
  imageUris: string[];
};

type StringFormField = {
  [Key in keyof ActivityFormState]: ActivityFormState[Key] extends string ? Key : never;
}[keyof ActivityFormState];

type BooleanFormField = {
  [Key in keyof ActivityFormState]: ActivityFormState[Key] extends boolean ? Key : never;
}[keyof ActivityFormState];

const INITIAL_FORM_STATE: ActivityFormState = {
  title: '',
  description: '',
  location: '',
  time: '',
  endTime: '',
  capacity: '6',
  latitude: '0',
  longitude: '0',
  tags: '',
  category: 'Social',
  visibility: 'everyone',
  requiresApproval: false,
  skillLevel: 'All Levels',
  ageRestriction: 'All Ages',
  equipmentRequired: '',
  weatherDependent: false,
  isTicketed: false,
  ticketPrice: '15',
  maxTickets: '40',
  requireQrCheckIn: true,
  imageUris: [],
};

const toFormDateTime = (value?: string | null): string => {
  if (!value?.trim()) {
    return '';
  }

  const parsed = new Date(value.includes(' ') ? value.replace(' ', 'T') : value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const VALID_VISIBILITY = ['everyone', 'friends', 'friendsOfFriends'] as const;

const VISIBILITY_OPTIONS: Array<{ value: (typeof VALID_VISIBILITY)[number]; label: string }> = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends' },
  { value: 'friendsOfFriends', label: 'Friends of friends' },
];

type CreateActivityScreenProps = {
  activityId?: number | string;
};

export const CreateActivityScreen = ({ activityId }: CreateActivityScreenProps = {}) => {
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuth();
  const isEditing = Boolean(activityId);

  // Defined only when rendered as the Host tab; the pushed Edit event screen has no tab bar.
  const tabBottomPadding = useTabScreenBottomPadding();
  const [form, setForm] = useState<ActivityFormState>(INITIAL_FORM_STATE);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const {
    ageRestriction,
    capacity,
    category,
    description,
    endTime,
    equipmentRequired,
    imageUris,
    isTicketed,
    latitude,
    location,
    longitude,
    maxTickets,
    requireQrCheckIn,
    requiresApproval,
    skillLevel,
    tags,
    ticketPrice,
    time,
    title,
    visibility,
    weatherDependent,
  } = form;
  const showTickets = isTicketingUiEnabled(config.ticketingEnabled);
  const ticketedUi = showTickets && isTicketed;

  const connectStatusQuery = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: fetchStripeConnectStatus,
    staleTime: 30_000,
    enabled: showTickets,
  });

  const activityQuery = useQuery({
    queryKey: ['mobile-activity', activityId],
    queryFn: () => fetchActivity(activityId!),
    enabled: Boolean(activityId),
  });

  const canSellTickets =
    Boolean(user?.canSellTickets) ||
    Boolean(connectStatusQuery.data?.payoutsEnabled) ||
    Boolean(connectStatusQuery.data?.onboardingComplete);

  const updateForm = <Key extends keyof ActivityFormState>(key: Key, value: ActivityFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateTextField = (key: StringFormField) => (value: string) => {
    updateForm(key, value);
  };

  const updateToggleField = (key: BooleanFormField) => (value: boolean) => {
    updateForm(key, value);
  };

  useEffect(() => {
    const activity = activityQuery.data;
    if (!activityId || !activity) {
      return;
    }

    const ticketed = Boolean(activity.isTicketed ?? activity.is_ticketed);
    const ticketPriceValue = activity.ticketPrice ?? activity.ticket_price;
    const maxTicketsValue = activity.maxTickets ?? activity.max_tickets ?? activity.capacity;

    setForm({
      ...INITIAL_FORM_STATE,
      title: activity.title ?? '',
      description: activity.description ?? '',
      location: activity.location ?? '',
      time: toFormDateTime(activity.time),
      capacity: String(activity.capacity ?? 6),
      latitude: String(activity.latitude ?? 0),
      longitude: String(activity.longitude ?? 0),
      tags: (activity.tags ?? []).join(', '),
      category: activity.category ?? 'Social',
      isTicketed: ticketed,
      ticketPrice: ticketPriceValue != null ? String(ticketPriceValue) : '15',
      maxTickets: maxTicketsValue != null ? String(maxTicketsValue) : '40',
      imageUris: normalizeEventImages(activity.images),
    });
  }, [activityId, activityQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: CreateActivityPayload) =>
      isEditing && activityId ? updateActivity(activityId, payload) : createActivity(payload),
    onSuccess: async () => {
      if (!isEditing) {
        setForm(INITIAL_FORM_STATE);
      }
      setTimeError(null);
      setPhotoError(null);

      await queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-hosted-activities'] });
      if (activityId) {
        await queryClient.invalidateQueries({ queryKey: ['mobile-activity', activityId] });
      }
      if (isEditing && navigation.canGoBack()) {
        navigation.goBack();
      }
    },
  });

  const ticketAmount = parseTicketPrice(ticketPrice);
  const feePreview = useMemo(() => hostFeePreviewCopy(ticketAmount), [ticketAmount]);
  const dateLabel = time.trim() ? formatEventDateLabel(time) : 'Sat, Jun 7, 2025';
  const timeLabel = time.trim() ? formatEventTimeLabel(time) : '7:00 PM';

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    location.trim().length > 0 &&
    time.trim().length > 0 &&
    Number(capacity) > 0 &&
    (!ticketedUi || (ticketAmount > 0 && Number(maxTickets) > 0));

  const clearTimeError = () => {
    if (timeError) {
      setTimeError(null);
    }
  };

  const buildPayload = (): { payload?: CreateActivityPayload; error?: string } => {
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      return { error: 'Latitude/Longitude must be valid numbers.' };
    }

    if (parsedLatitude === 0 && parsedLongitude === 0) {
      return { error: 'Use current location to set coordinates before creating the activity.' };
    }

    const normalizedStartTime = normalizeDateTime(time);
    const normalizedEndTime = normalizeDateTime(endTime);

    if (!normalizedStartTime) {
      return { error: 'Start time looks off. Use YYYY-MM-DD HH:mm.' };
    }

    if (endTime.trim() && !normalizedEndTime) {
      return { error: 'End time looks off. Use YYYY-MM-DD HH:mm.' };
    }

    if (normalizedEndTime && new Date(normalizedEndTime).getTime() <= new Date(normalizedStartTime).getTime()) {
      return { error: 'End time must be after the start time.' };
    }

    const visibilityValue = visibility.trim() || 'everyone';
    const normalizedVisibility = VALID_VISIBILITY.includes(visibilityValue as (typeof VALID_VISIBILITY)[number])
      ? visibilityValue
      : 'everyone';

    return {
      payload: {
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || 'Social',
        location: location.trim(),
        time: normalizedStartTime,
        end_time: normalizedEndTime ?? undefined,
        capacity: Math.min(10, Math.max(1, Number(capacity) || 1)),
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        visibility: [normalizedVisibility],
        is_private: normalizedVisibility !== 'everyone',
        requires_approval: requiresApproval,
        price: 0,
        currency: 'USD',
        age_restriction: ageRestriction.trim(),
        skill_level: skillLevel.trim(),
        equipment_provided: false,
        equipment_required: equipmentRequired.trim(),
        weather_dependent: weatherDependent,
        tags: tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        ...createEventImagePayload(imageUris),
        ...createEventTicketPayload(ticketedUi, ticketPrice, maxTickets),
      },
    };
  };

  const handlePickImages = async () => {
    const remaining = MAX_EVENT_PHOTOS - imageUris.length;
    if (remaining <= 0) {
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      setPhotoError('Photo library permission is required to add event photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: remaining,
    });

    if (!result.canceled) {
      const prepared = await Promise.all(
        result.assets.map((asset) => imageAssetToUploadDataUrl(asset).catch(() => null)),
      );
      const selected = prepared.filter((item): item is string => Boolean(item));
      if (selected.length === 0) {
        setPhotoError('Use JPEG, PNG, or WebP photos.');
        return;
      }
      setPhotoError(null);
      setForm((current) => ({
        ...current,
        imageUris: [...current.imageUris, ...selected].slice(0, MAX_EVENT_PHOTOS),
      }));
    }
  };

  const normalizeDateTime = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00Z`).toISOString();
    }

    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}$/.test(trimmed)) {
      return new Date(trimmed.replace(' ', 'T')).toISOString();
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return null;
  };

  const fillCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const { latitude: currentLat, longitude: currentLng } = currentLocation.coords;
      setForm((current) => ({
        ...current,
        latitude: String(currentLat),
        longitude: String(currentLng),
      }));

      const reverse = await Location.reverseGeocodeAsync({
        latitude: currentLat,
        longitude: currentLng,
      });
      const firstMatch = reverse[0];
      if (firstMatch && !location.trim()) {
        const city = firstMatch.city || firstMatch.subregion || firstMatch.region || '';
        const country = firstMatch.country || '';
        const label = [city, country].filter(Boolean).join(', ');
        if (label) {
          updateForm('location', label);
        }
      }
    } finally {
      setIsLocating(false);
    }
  };

  const publishEvent = () => {
    const { error, payload } = buildPayload();

    if (error) {
      setTimeError(error);
      return;
    }

    setTimeError(null);
    saveMutation.mutate(payload!);
  };

  return (
    <View style={styles.frameRoot}>
      <SafeAreaView edges={['top']} style={styles.coralHeader}>
        <FoyerHeader tone="onPrimary" />
      </SafeAreaView>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[
          styles.sheetContent,
          tabBottomPadding != null ? { paddingBottom: tabBottomPadding } : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Field
          accentLabel
          label="Event title"
          value={title}
          onChangeText={updateTextField('title')}
          placeholder="Rooftop sunset hang"
        />

        <Text style={styles.accentLabel}>Date & time</Text>
        <View style={styles.splitField}>
          <View style={styles.splitSide}>
            <MaterialCommunityIcons name="calendar" size={18} color={appColors.primary} />
            <TextInput
              value={time}
              placeholder={dateLabel}
              placeholderTextColor={appColors.softInk}
              onChangeText={(value) => {
                updateForm('time', value);
                clearTimeError();
              }}
              style={styles.inlineInput}
            />
          </View>
          <View style={styles.splitDivider} />
          <View style={styles.splitSide}>
            <Text style={styles.splitTime}>{time.trim() ? timeLabel : '7:00 PM'}</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={appColors.softInk} />
          </View>
        </View>
        {timeError ? <Text style={styles.errorText}>{timeError}</Text> : null}

        <Text style={styles.accentLabel}>Location</Text>
        <View style={styles.singleField}>
          <MaterialCommunityIcons name="map-marker" size={18} color={appColors.primary} />
          <TextInput
            value={location}
            placeholder="Mission Dolores"
            placeholderTextColor={appColors.softInk}
            onChangeText={updateTextField('location')}
            style={styles.inlineInput}
          />
          <MaterialCommunityIcons name="chevron-right" size={18} color={appColors.softInk} />
        </View>
        <AppButton variant="ghost" compact onPress={fillCurrentLocation} loading={isLocating} style={styles.inlineButton}>
          Use current location
        </AppButton>

        <EventPhotoSlots
          images={imageUris}
          onAdd={() => {
            void handlePickImages();
          }}
          onRemove={(index) => {
            setForm((current) => ({
              ...current,
              imageUris: current.imageUris.filter((_, currentIndex) => currentIndex !== index),
            }));
          }}
        />
        {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}

        {showTickets ? (
          <>
            <View style={styles.checkInRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.checkInLabel}>Ticketed event</Text>
                <Text style={styles.switchSubtitle}>Guests buy a ticket before they can attend.</Text>
              </View>
              <Switch
                accessibilityLabel="Ticketed event"
                value={isTicketed}
                onValueChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    isTicketed: value,
                    maxTickets:
                      value && !current.maxTickets.trim() ? current.capacity || '40' : current.maxTickets,
                  }));
                }}
                trackColor={{ false: appColors.line, true: appColors.primary }}
                thumbColor={appColors.white}
              />
            </View>

            {isTicketed ? (
              <>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Field
                      accentLabel
                      label="Ticket price"
                      value={ticketPrice}
                      onChangeText={updateTextField('ticketPrice')}
                      placeholder="$15"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.half}>
                    <Field
                      accentLabel
                      label="Capacity"
                      value={maxTickets}
                      onChangeText={(value) => {
                        updateTextField('maxTickets')(value);
                        updateForm('capacity', value);
                      }}
                      placeholder="40"
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={styles.feePreview}>
                  <MaterialCommunityIcons name="information" size={18} color={appColors.primary} />
                  <Text style={styles.feePreviewText}>{feePreview}</Text>
                </View>

                <View style={styles.checkInRow}>
                  <Text style={styles.checkInLabel}>Require QR check-in</Text>
                  <Switch
                    accessibilityLabel="Require QR check-in"
                    value={requireQrCheckIn}
                    onValueChange={updateToggleField('requireQrCheckIn')}
                    trackColor={{ false: appColors.line, true: appColors.primary }}
                    thumbColor={appColors.white}
                  />
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {saveMutation.error ? (
          <Text style={styles.errorText}>
            {getErrorMessage(saveMutation.error, isEditing ? 'Unable to save activity.' : 'Unable to create activity.')}
          </Text>
        ) : null}

        {saveMutation.isSuccess && !isEditing ? (
          <PanelCard tone="accent">
            <AccentPill tone="secondary">Saved</AccentPill>
            <Text style={styles.successText}>Activity created successfully.</Text>
          </PanelCard>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={createEventPrimaryCtaLabel(ticketedUi, saveMutation.isPending, isEditing)}
          disabled={!canSubmit || saveMutation.isPending || isLocating}
          onPress={publishEvent}
          style={[styles.publishBtn, (!canSubmit || saveMutation.isPending || isLocating) && styles.publishDisabled]}
        >
          <Text style={styles.publishLabel}>
            {createEventPrimaryCtaLabel(ticketedUi, saveMutation.isPending, isEditing)}
          </Text>
          <MaterialCommunityIcons
            name={ticketedUi ? 'ticket-confirmation-outline' : 'check'}
            size={20}
            color={appColors.white}
          />
        </Pressable>

        {ticketedUi && !canSellTickets ? (
          <AppButton variant="outline" onPress={() => navigation.navigate('GetPaid')}>
            Set up payouts
          </AppButton>
        ) : null}

        {showTickets ? (
          <View style={styles.footerRow}>
            <MaterialCommunityIcons name="lock-outline" size={14} color={appColors.primaryDeep} />
            <Text style={styles.footerText}>{PROTOTYPE_FOOTER_HOST}</Text>
          </View>
        ) : null}

        <PanelCard>
          <SectionIntro
            eyebrow="More details"
            title="What is this activity?"
            subtitle="These extras still publish with the event."
          />
          <Field
            label="Description"
            value={description}
            onChangeText={updateTextField('description')}
            multiline
            numberOfLines={4}
            style={styles.multiline}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label="Category" value={category} onChangeText={updateTextField('category')} />
            </View>
            <View style={styles.half}>
              <Field label="Tags" value={tags} onChangeText={updateTextField('tags')} placeholder="music, rooftop" />
            </View>
          </View>
          <Field
            label="Ends (optional)"
            value={endTime}
            onChangeText={(value: string) => {
              updateForm('endTime', value);
              clearTimeError();
            }}
            placeholder="2026-08-14 21:00"
            autoCapitalize="none"
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label="Latitude" value={latitude} onChangeText={updateTextField('latitude')} keyboardType="decimal-pad" />
            </View>
            <View style={styles.half}>
              <Field
                label="Longitude"
                value={longitude}
                onChangeText={updateTextField('longitude')}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <Text style={styles.chipLabel}>Visibility</Text>
          <View style={styles.chipRow}>
            {VISIBILITY_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={visibility === option.value}
                tone="primary"
                onPress={() => updateForm('visibility', option.value)}
              />
            ))}
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label="Skill level" value={skillLevel} onChangeText={updateTextField('skillLevel')} />
            </View>
            <View style={styles.half}>
              <Field label="Age restriction" value={ageRestriction} onChangeText={updateTextField('ageRestriction')} />
            </View>
          </View>
          <Field
            label="Equipment required"
            value={equipmentRequired}
            onChangeText={updateTextField('equipmentRequired')}
          />
          <View style={styles.preferenceCard}>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>Requires approval</Text>
                <Text style={styles.switchSubtitle}>Review attendees before they join.</Text>
              </View>
              <Switch value={requiresApproval} onValueChange={updateToggleField('requiresApproval')} />
            </View>
            <View style={styles.switchDivider} />
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>Weather dependent</Text>
                <Text style={styles.switchSubtitle}>Signal that outdoor conditions can change the plan.</Text>
              </View>
              <Switch value={weatherDependent} onValueChange={updateToggleField('weatherDependent')} />
            </View>
          </View>
        </PanelCard>
      </ScrollView>
    </View>
  );
};

export const EditActivityScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'EditActivity'>>();
  return <CreateActivityScreen activityId={route.params.activityId} />;
};

const styles = StyleSheet.create({
  frameRoot: {
    flex: 1,
    backgroundColor: appColors.primary,
  },
  coralHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparkRow: {
    flexDirection: 'row',
    gap: 4,
  },
  sheet: {
    flex: 1,
    backgroundColor: appColors.white,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 120,
    gap: 14,
  },
  accentLabel: {
    color: appColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  splitField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    overflow: 'hidden',
  },
  splitSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  splitDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: appColors.line,
  },
  splitTime: {
    flex: 1,
    color: appColors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  singleField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 12,
    gap: 8,
  },
  inlineInput: {
    flex: 1,
    color: appColors.ink,
    fontSize: 16,
    paddingVertical: 12,
  },
  feePreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: appColors.primarySoft,
    borderWidth: 1,
    borderColor: appColors.primary,
  },
  feePreviewText: {
    flex: 1,
    color: appColors.primaryDeep,
    fontWeight: '700',
    lineHeight: 20,
  },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 6,
  },
  checkInLabel: {
    color: appColors.ink,
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    fontWeight: '700',
  },
  publishBtn: {
    minHeight: 54,
    borderRadius: radii.pill,
    paddingHorizontal: 20,
    backgroundColor: appColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  publishDisabled: {
    opacity: 0.45,
  },
  publishLabel: {
    color: appColors.white,
    fontFamily: appTypography.bodySemibold,
    fontSize: 17,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  footerText: {
    color: appColors.primaryDeep,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  half: {
    flex: 1,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  chipLabel: {
    color: appColors.mutedInk,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineButton: {
    alignSelf: 'flex-start',
  },
  hintText: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: appColors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  preferenceCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.card,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  switchCopy: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    color: appColors.ink,
    fontWeight: '700',
  },
  switchSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  switchDivider: {
    height: 1,
    backgroundColor: appColors.line,
  },
  successText: {
    color: appColors.ink,
    fontWeight: '700',
  },
});
