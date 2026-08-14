import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet, Switch, Text } from 'react-native';

import { AccentPill, AppScrollView, EmptyStatePanel, PageHeader, PanelCard, SectionIntro } from '@components/AppChrome';
import { Image, View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { Chip } from '@components/ui/Chip';
import { Field } from '@components/ui/Field';
import { useAuth } from '@hooks/useAuth';
import { createActivity } from '@services/activityService';
import type { CreateActivityPayload } from '@services/activityService';
import {
  fetchStripeConnectStatus,
  openStripeConnectOnboarding,
} from '@services/paymentService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';
import { imageAssetToUploadDataUrl } from '@utils/profileImages';

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
  ticketPrice: '',
  maxTickets: '',
  imageUris: [],
};

const VALID_VISIBILITY = ['everyone', 'friends', 'friendsOfFriends'] as const;

const VISIBILITY_OPTIONS: Array<{ value: (typeof VALID_VISIBILITY)[number]; label: string }> = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends' },
  { value: 'friendsOfFriends', label: 'Friends of friends' },
];

export const CreateActivityScreen = () => {
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();

  const [form, setForm] = useState<ActivityFormState>(INITIAL_FORM_STATE);
  const [timeError, setTimeError] = useState<string | null>(null);
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
    requiresApproval,
    skillLevel,
    tags,
    ticketPrice,
    time,
    title,
    visibility,
    weatherDependent,
  } = form;

  const connectStatusQuery = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: fetchStripeConnectStatus,
    staleTime: 30_000,
  });

  const stripeConnectUnavailable = connectStatusQuery.data?.available === false;
  const canSellTickets =
    !stripeConnectUnavailable &&
    (Boolean(user?.canSellTickets) ||
      Boolean(connectStatusQuery.data?.payoutsEnabled) ||
      Boolean(connectStatusQuery.data?.onboardingComplete));

  const onboardMutation = useMutation({
    mutationFn: openStripeConnectOnboarding,
    onSuccess: async () => {
      await connectStatusQuery.refetch();
      await refreshProfile();
    },
  });

  const updateForm = <Key extends keyof ActivityFormState>(key: Key, value: ActivityFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateTextField = (key: StringFormField) => (value: string) => {
    updateForm(key, value);
  };

  const updateToggleField = (key: BooleanFormField) => (value: boolean) => {
    updateForm(key, value);
  };

  const createMutation = useMutation({
    mutationFn: createActivity,
    onSuccess: async () => {
      setForm(INITIAL_FORM_STATE);
      setTimeError(null);

      await queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-hosted-activities'] });
    },
  });

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    location.trim().length > 0 &&
    time.trim().length > 0 &&
    Number(capacity) > 0 &&
    (!isTicketed || (canSellTickets && Number(ticketPrice) > 0 && Number(maxTickets) > 0));

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
        images: imageUris,
        is_ticketed: isTicketed,
        ticket_price: isTicketed ? Number(ticketPrice) : undefined,
        max_tickets: isTicketed ? Number(maxTickets) : undefined,
      },
    };
  };

  const handlePickImages = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      const prepared = await Promise.all(
        result.assets.map((asset) => imageAssetToUploadDataUrl(asset).catch(() => null)),
      );
      const selected = prepared.filter((item): item is string => Boolean(item));
      setForm((current) => ({
        ...current,
        imageUris: [...current.imageUris, ...selected].slice(0, 5),
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

  return (
    <AppScrollView contentContainerStyle={styles.container}>
      <PageHeader
        eyebrow="Host"
        title="Create activity"
        subtitle="Shape the plan before anyone sees it. Lead with the essentials, then layer in the details that make the event feel worth showing up for."
      />

      <PanelCard style={styles.heroCard}>
        <AccentPill tone="secondary">Production flow</AccentPill>
        <Text style={styles.heroTitle}>
          Publish something people can commit to fast.
        </Text>
        <Text style={styles.heroSubtitle}>
          Strong title, clear timing, real location, and a few images do most of the work.
        </Text>
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Core"
          title="What is this activity?"
          subtitle="Start with the event identity people use to decide if it’s worth a closer look."
        />
        <Field label="Title" value={title} onChangeText={updateTextField('title')} />
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
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Schedule & place"
          title="When and where does it happen?"
          subtitle="Make timing and location concrete so people can say yes quickly."
        />
        <Field label="Location" value={location} onChangeText={updateTextField('location')} />
        <AppButton variant="outline" onPress={fillCurrentLocation} loading={isLocating} style={styles.inlineButton}>
          Use current location
        </AppButton>
        <Field
          label="Starts"
          value={time}
          onChangeText={(value: string) => {
            updateForm('time', value);
            clearTimeError();
          }}
          placeholder="2026-08-14 19:00"
          autoCapitalize="none"
          error={timeError ?? undefined}
        />
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
            <Field
              label="Latitude"
              value={latitude}
              onChangeText={updateTextField('latitude')}
              keyboardType="decimal-pad"
            />
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
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Attendance"
          title="Who is this for?"
          subtitle="Set boundaries and expectations without burying people in admin."
        />
        <Field
          label="Capacity (1–10)"
          value={capacity}
          onChangeText={updateTextField('capacity')}
          keyboardType="number-pad"
        />
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

      <PanelCard>
        <SectionIntro
          eyebrow="Tickets"
          title="Charge for this event"
          subtitle="IRLobby takes a 10% platform fee. The rest goes to your connected payout account."
        />
        <View style={styles.preferenceCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>Ticketed event</Text>
              <Text style={styles.switchSubtitle}>
                Guests buy a ticket in the app before they can attend.
              </Text>
            </View>
            <Switch
              value={isTicketed}
              disabled={stripeConnectUnavailable}
              onValueChange={(value) => {
                updateForm('isTicketed', value);
                if (value && !maxTickets) {
                  updateForm('maxTickets', capacity || '6');
                }
              }}
            />
          </View>
        </View>
        {stripeConnectUnavailable ? (
          <Text style={styles.hintText}>
            Ticket sales aren’t live on this server yet. You can still host a free plan.
          </Text>
        ) : isTicketed ? (
          <>
            {!canSellTickets ? (
              <Text style={styles.hintText}>
                Finish payout setup with Stripe before you can sell tickets.
              </Text>
            ) : null}
            {!canSellTickets ? (
              <AppButton onPress={() => onboardMutation.mutate()} loading={onboardMutation.isPending} style={styles.inlineButton}>
                Set up payouts
              </AppButton>
            ) : (
              <Text style={styles.hintText}>
                Payouts are ready. Ticket sales will send 90% to you and 10% to IRLobby.
              </Text>
            )}
            <View style={styles.row}>
              <View style={styles.half}>
                <Field
                  label="Ticket price (USD)"
                  value={ticketPrice}
                  onChangeText={updateTextField('ticketPrice')}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.half}>
                <Field
                  label="Tickets available"
                  value={maxTickets}
                  onChangeText={updateTextField('maxTickets')}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </>
        ) : null}
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Media"
          title="Show the vibe"
          subtitle="A few good images make the event feel real before anyone opens the details sheet."
        />
        <AppButton variant="outline" onPress={handlePickImages} style={styles.inlineButton}>
          Pick up to 5 images
        </AppButton>
        {imageUris.length > 0 ? (
          <View style={styles.mediaGrid}>
            {imageUris.map((uri, index) => (
              <View key={`${index}-${uri.slice(0, 16)}`} style={styles.mediaTile}>
                <Image source={{ uri }} style={styles.mediaImage} />
                <AppButton
                  variant="ghost"
                  compact
                  onPress={() => {
                    setForm((current) => ({
                      ...current,
                      imageUris: current.imageUris.filter((_, currentIndex) => currentIndex !== index),
                    }));
                  }}
                >
                  Remove
                </AppButton>
              </View>
            ))}
          </View>
        ) : (
          <EmptyStatePanel
            title="No media selected yet"
            description="Add a few images so the card feels alive when it appears in discovery."
          />
        )}
      </PanelCard>

      {createMutation.error ? (
        <Text style={styles.errorText}>
          {getErrorMessage(createMutation.error, 'Unable to create activity.')}
        </Text>
      ) : null}

      {createMutation.isSuccess ? (
        <PanelCard tone="accent">
          <AccentPill tone="secondary">Saved</AccentPill>
          <Text style={styles.successText}>Activity created successfully.</Text>
        </PanelCard>
      ) : null}

      <PanelCard style={styles.submitCard}>
        <Text style={styles.submitTitle}>Ready to publish?</Text>
        <Text style={styles.submitSubtitle}>
          We’ll validate timing and coordinates before this goes live in discovery.
        </Text>
        <AppButton
          loading={createMutation.isPending}
          disabled={!canSubmit || createMutation.isPending || isLocating}
          onPress={() => {
            const { error, payload } = buildPayload();

            if (error) {
              setTimeError(error);
              return;
            }

            setTimeError(null);
            createMutation.mutate(payload!);
          }}
        >
          Create activity
        </AppButton>
      </PanelCard>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  heroCard: {
    gap: 10,
  },
  heroTitle: {
    color: appColors.ink,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 22,
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
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mediaTile: {
    width: '47%',
    gap: 6,
  },
  mediaImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: appColors.cardStrong,
  },
  successText: {
    color: appColors.ink,
    fontWeight: '700',
  },
  submitCard: {
    gap: 10,
  },
  submitTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  submitSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 22,
  },
});
