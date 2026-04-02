import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Switch, Text } from 'react-native-paper';

import { AccentPill, AppScrollView, EmptyStatePanel, PageHeader, PanelCard, SectionIntro } from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { Image, View } from '@components/RNCompat';
import { createActivity } from '@services/activityService';
import type { CreateActivityPayload } from '@services/activityService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

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
  imageUris: [],
};

const VALID_VISIBILITY = ['everyone', 'friends', 'friendsOfFriends'] as const;

export const CreateActivityScreen = () => {
  const queryClient = useQueryClient();

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
    latitude,
    location,
    longitude,
    requiresApproval,
    skillLevel,
    tags,
    time,
    title,
    visibility,
    weatherDependent,
  } = form;

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
    Number(capacity) > 0;

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
      return { error: 'Start time format is invalid. Use ISO or YYYY-MM-DD HH:mm.' };
    }

    if (endTime.trim() && !normalizedEndTime) {
      return { error: 'End time format is invalid. Use ISO or YYYY-MM-DD HH:mm.' };
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
      base64: true,
      quality: 0.7,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      const selected = result.assets.flatMap((asset) => {
        if (!asset.base64) {
          return [];
        }

        const mimeType = asset.mimeType || 'image/jpeg';
        return [`data:${mimeType};base64,${asset.base64}`];
      });
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
        <Text variant="titleLarge" style={styles.heroTitle}>
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
        <TextInput label="Title" value={title} onChangeText={updateTextField('title')} mode="outlined" style={styles.input} />
        <TextInput
          label="Description"
          value={description}
          onChangeText={updateTextField('description')}
          multiline
          mode="outlined"
          style={styles.input}
        />
        <View style={styles.row}>
          <TextInput label="Category" value={category} onChangeText={updateTextField('category')} mode="outlined" style={[styles.input, styles.half]} />
          <TextInput label="Tags (comma separated)" value={tags} onChangeText={updateTextField('tags')} mode="outlined" style={[styles.input, styles.half]} />
        </View>
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Schedule & place"
          title="When and where does it happen?"
          subtitle="Make timing and location concrete so people can say yes quickly."
        />
        <TextInput label="Location" value={location} onChangeText={updateTextField('location')} mode="outlined" style={styles.input} />
        <Button mode="outlined" onPress={fillCurrentLocation} loading={isLocating} style={styles.inlineButton}>
          Use current location
        </Button>
        <TextInput
          label="Start date & time (ISO or YYYY-MM-DD HH:mm)"
          value={time}
          onChangeText={(value: string) => {
            updateForm('time', value);
            clearTimeError();
          }}
          mode="outlined"
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          label="End date & time (optional)"
          value={endTime}
          onChangeText={(value: string) => {
            updateForm('endTime', value);
            clearTimeError();
          }}
          mode="outlined"
          style={styles.input}
          autoCapitalize="none"
        />
        {timeError ? (
          <HelperText type="error" visible>
            {timeError}
          </HelperText>
        ) : null}
        <View style={styles.row}>
          <TextInput
            label="Latitude"
            value={latitude}
            onChangeText={updateTextField('latitude')}
            keyboardType="decimal-pad"
            mode="outlined"
            style={[styles.input, styles.half]}
          />
          <TextInput
            label="Longitude"
            value={longitude}
            onChangeText={updateTextField('longitude')}
            keyboardType="decimal-pad"
            mode="outlined"
            style={[styles.input, styles.half]}
          />
        </View>
      </PanelCard>

      <PanelCard>
        <SectionIntro
          eyebrow="Attendance"
          title="Who is this for?"
          subtitle="Set boundaries and expectations without burying people in admin."
        />
        <View style={styles.row}>
          <TextInput
            label="Capacity (1-10)"
            value={capacity}
            onChangeText={updateTextField('capacity')}
            keyboardType="number-pad"
            mode="outlined"
            style={[styles.input, styles.half]}
          />
          <TextInput
            label="Visibility"
            value={visibility}
            onChangeText={updateTextField('visibility')}
            mode="outlined"
            style={[styles.input, styles.half]}
          />
        </View>
        <View style={styles.row}>
          <TextInput label="Skill level" value={skillLevel} onChangeText={updateTextField('skillLevel')} mode="outlined" style={[styles.input, styles.half]} />
          <TextInput label="Age restriction" value={ageRestriction} onChangeText={updateTextField('ageRestriction')} mode="outlined" style={[styles.input, styles.half]} />
        </View>
        <TextInput
          label="Equipment required"
          value={equipmentRequired}
          onChangeText={updateTextField('equipmentRequired')}
          mode="outlined"
          style={styles.input}
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
          eyebrow="Media"
          title="Show the vibe"
          subtitle="A few good images make the event feel real before anyone opens the details sheet."
        />
        <Button mode="outlined" onPress={handlePickImages} style={styles.inlineButton}>
          Pick up to 5 images
        </Button>
        {imageUris.length > 0 ? (
          <View style={styles.mediaGrid}>
            {imageUris.map((uri, index) => (
              <View key={`${index}-${uri.slice(0, 16)}`} style={styles.mediaTile}>
                <Image source={{ uri }} style={styles.mediaImage} />
                <Button
                  mode="text"
                  compact
                  onPress={() => {
                    setForm((current) => ({
                      ...current,
                      imageUris: current.imageUris.filter((_, currentIndex) => currentIndex !== index),
                    }));
                  }}
                >
                  Remove
                </Button>
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
        <HelperText type="error" visible>
          {getErrorMessage(createMutation.error, 'Unable to create activity.')}
        </HelperText>
      ) : null}

      {createMutation.isSuccess ? (
        <PanelCard tone="accent">
          <AccentPill tone="secondary">Saved</AccentPill>
          <Text style={styles.successText}>Activity created successfully.</Text>
        </PanelCard>
      ) : null}

      <PanelCard style={styles.submitCard}>
        <Text variant="titleMedium" style={styles.submitTitle}>
          Ready to publish?
        </Text>
        <Text style={styles.submitSubtitle}>
          We’ll validate timing and coordinates before this goes live in discovery.
        </Text>
        <Button
          mode="contained"
          buttonColor={appColors.primary}
          loading={createMutation.isPending}
          disabled={!canSubmit || createMutation.isPending || isLocating}
          contentStyle={styles.submitButtonContent}
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
        </Button>
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
    alignItems: 'center',
  },
  half: {
    flex: 1,
  },
  input: {
    backgroundColor: appColors.card,
  },
  inlineButton: {
    alignSelf: 'flex-start',
  },
  preferenceCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#edf1f7',
    backgroundColor: '#fbfcff',
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
    backgroundColor: '#edf1f7',
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
    backgroundColor: '#edf2f8',
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
  submitButtonContent: {
    minHeight: 52,
  },
});
