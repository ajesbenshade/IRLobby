import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Switch, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createActivity } from '@services/activityService';
import { getErrorMessage } from '@utils/error';

import type { MainTabParamList } from '@navigation/types';

type CreateStep = 'details' | 'whenWhere' | 'preferences';

const STEP_ORDER: CreateStep[] = ['details', 'whenWhere', 'preferences'];

const STEP_LABELS: Record<CreateStep, string> = {
  details: 'Details',
  whenWhere: 'When & where',
  preferences: 'Preferences',
};

export const CreateActivityScreen = () => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<CreateStep>('details');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState('6');
  const [latitude, setLatitude] = useState('0');
  const [longitude, setLongitude] = useState('0');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('Social');
  const [visibility, setVisibility] = useState('everyone');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [skillLevel, setSkillLevel] = useState('All Levels');
  const [ageRestriction, setAgeRestriction] = useState('All Ages');
  const [equipmentRequired, setEquipmentRequired] = useState('');
  const [weatherDependent, setWeatherDependent] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const createMutation = useMutation({
    mutationFn: createActivity,
    onSuccess: async () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitle('');
      setDescription('');
      setLocation('');
      setTime('');
      setEndTime('');
      setCapacity('6');
      setLatitude('0');
      setLongitude('0');
      setTags('');
      setCategory('Social');
      setVisibility('everyone');
      setRequiresApproval(false);
      setSkillLevel('All Levels');
      setAgeRestriction('All Ages');
      setEquipmentRequired('');
      setWeatherDependent(false);
      setImageUris([]);
      setFormError(null);
      setStep('details');

      await queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-hosted-activities'] });

      navigation.navigate('Discover');
    },
  });

  const canProceedDetails = title.trim().length > 0 && description.trim().length > 0;
  const canProceedWhenWhere = location.trim().length > 0 && time.trim().length > 0;

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
      setImageUris((previous) => [...previous, ...selected].slice(0, 5));
    }
  };

  const removeImageAtIndex = (targetIndex: number) => {
    setImageUris((previous) => previous.filter((_, index) => index !== targetIndex));
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
        setFormError('Location permission is required to auto-fill coordinates.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const { latitude: currentLat, longitude: currentLng } = currentLocation.coords;
      setLatitude(String(currentLat));
      setLongitude(String(currentLng));

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
          setLocation(label);
        }
      }
    } finally {
      setIsLocating(false);
    }
  };

  const goNext = () => {
    setFormError(null);

    if (step === 'details') {
      if (!canProceedDetails) {
        setFormError('Title and description are required.');
        return;
      }
      void Haptics.selectionAsync();
      setStep('whenWhere');
      return;
    }

    if (step === 'whenWhere') {
      if (!canProceedWhenWhere) {
        setFormError('Location and start time are required.');
        return;
      }
      void Haptics.selectionAsync();
      setStep('preferences');
    }
  };

  const goBack = () => {
    setFormError(null);
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex <= 0) {
      return;
    }
    void Haptics.selectionAsync();
    setStep(STEP_ORDER[currentIndex - 1]);
  };

  const submit = () => {
    setFormError(null);

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      setFormError('Latitude/Longitude must be valid numbers.');
      return;
    }

    if (parsedLatitude === 0 && parsedLongitude === 0) {
      setFormError('Use current location to set coordinates before creating the activity.');
      return;
    }

    const normalizedStartTime = normalizeDateTime(time);
    const normalizedEndTime = normalizeDateTime(endTime);

    if (!normalizedStartTime) {
      setFormError('Start time format is invalid. Use ISO or YYYY-MM-DD HH:mm.');
      return;
    }

    if (endTime.trim() && !normalizedEndTime) {
      setFormError('End time format is invalid. Use ISO or YYYY-MM-DD HH:mm.');
      return;
    }

    if (normalizedEndTime && new Date(normalizedEndTime).getTime() <= new Date(normalizedStartTime).getTime()) {
      setFormError('End time must be after the start time.');
      return;
    }

    const visibilityValue = visibility.trim() || 'everyone';
    const validVisibility = ['everyone', 'friends', 'friendsOfFriends'];
    const normalizedVisibility = validVisibility.includes(visibilityValue) ? visibilityValue : 'everyone';

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    createMutation.mutate({
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
    });
  };

  const stepIndex = STEP_ORDER.indexOf(step);
  const stepLabel = STEP_LABELS[step];

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Surface elevation={2} style={styles.card}>
        <Text variant="headlineSmall">Create Activity</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {`Step ${stepIndex + 1} of ${STEP_ORDER.length}: ${stepLabel}`}
        </Text>

        {formError ? (
          <HelperText type="error" visible>
            {formError}
          </HelperText>
        ) : null}

        {step === 'details' ? (
          <>
            <TextInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
            <TextInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              style={styles.input}
            />
            <TextInput
              label="Category"
              value={category}
              onChangeText={setCategory}
              style={styles.input}
            />
            <TextInput
              label="Tags (comma separated)"
              value={tags}
              onChangeText={setTags}
              style={styles.input}
            />
          </>
        ) : null}

        {step === 'whenWhere' ? (
          <>
            <TextInput
              label="Location"
              value={location}
              onChangeText={setLocation}
              style={styles.input}
            />

            <Button mode="outlined" onPress={fillCurrentLocation} loading={isLocating}>
              Use current location
            </Button>

            <View style={styles.row}>
              <TextInput
                label="Latitude"
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="decimal-pad"
                style={[styles.input, styles.half]}
              />
              <TextInput
                label="Longitude"
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="decimal-pad"
                style={[styles.input, styles.half]}
              />
            </View>

            <TextInput
              label="Start date & time (ISO or YYYY-MM-DD HH:mm)"
              value={time}
              onChangeText={(value) => {
                setTime(value);
                if (formError) {
                  setFormError(null);
                }
              }}
              style={styles.input}
              autoCapitalize="none"
            />
            <TextInput
              label="End date & time (optional)"
              value={endTime}
              onChangeText={(value) => {
                setEndTime(value);
                if (formError) {
                  setFormError(null);
                }
              }}
              style={styles.input}
              autoCapitalize="none"
            />
          </>
        ) : null}

        {step === 'preferences' ? (
          <>
            <TextInput
              label="Capacity (1-10)"
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
              style={styles.input}
            />
            <TextInput
              label="Visibility (everyone/friends/friendsOfFriends)"
              value={visibility}
              onChangeText={setVisibility}
              style={styles.input}
              autoCapitalize="none"
            />
            <TextInput
              label="Skill level"
              value={skillLevel}
              onChangeText={setSkillLevel}
              style={styles.input}
            />
            <TextInput
              label="Age restriction"
              value={ageRestriction}
              onChangeText={setAgeRestriction}
              style={styles.input}
            />
            <TextInput
              label="Equipment required"
              value={equipmentRequired}
              onChangeText={setEquipmentRequired}
              style={styles.input}
            />

            <View style={styles.switchRow}>
              <Text>Requires approval</Text>
              <Switch value={requiresApproval} onValueChange={setRequiresApproval} />
            </View>
            <View style={styles.switchRow}>
              <Text>Weather dependent</Text>
              <Switch value={weatherDependent} onValueChange={setWeatherDependent} />
            </View>

            <Button mode="outlined" onPress={handlePickImages} disabled={imageUris.length >= 5}>
              Pick up to 5 images
            </Button>
            <Text variant="bodySmall">Selected images: {imageUris.length} / 5</Text>

            {imageUris.length ? (
              <View style={styles.imageList}>
                {imageUris.map((_, index) => (
                  <View key={String(index)} style={styles.imageRow}>
                    <Text numberOfLines={1} style={styles.imageLabel}>
                      {`Image ${index + 1}`}
                    </Text>
                    <Button mode="text" compact onPress={() => removeImageAtIndex(index)}>
                      Remove
                    </Button>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {createMutation.error ? (
          <HelperText type="error" visible>
            {getErrorMessage(createMutation.error, 'Unable to create activity.')}
          </HelperText>
        ) : null}

        {createMutation.isSuccess ? (
          <HelperText type="info" visible>
            Activity created successfully.
          </HelperText>
        ) : null}

        <View style={styles.navRow}>
          <Button mode="outlined" onPress={goBack} disabled={step === 'details' || createMutation.isPending}>
            Back
          </Button>

          {step !== 'preferences' ? (
            <Button
              mode="contained"
              onPress={goNext}
              disabled={
                createMutation.isPending ||
                (step === 'details' ? !canProceedDetails : !canProceedWhenWhere) ||
                isLocating
              }
            >
              Next
            </Button>
          ) : (
            <Button
              mode="contained"
              loading={createMutation.isPending}
              disabled={createMutation.isPending || isLocating}
              onPress={submit}
            >
              Create activity
            </Button>
          )}
        </View>
      </Surface>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  subtitle: {
    opacity: 0.75,
  },
  input: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageList: {
    gap: 6,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  imageLabel: {
    flex: 1,
    opacity: 0.75,
  },
  half: {
    flex: 1,
  },
});
