import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Switch, Text, TextInput } from 'react-native-paper';

import { createActivity } from '@services/activityService';
import { getErrorMessage } from '@utils/error';

export const CreateActivityScreen = () => {
  const queryClient = useQueryClient();

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
  const [timeError, setTimeError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const createMutation = useMutation({
    mutationFn: createActivity,
    onSuccess: async () => {
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
      setTimeError(null);

      await queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-hosted-activities'] });
    },
  });

  const canSubmit =
    title.trim().length > 0 &&
    location.trim().length > 0 &&
    time.trim().length > 0 &&
    Number(capacity) > 0;

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
      const selected = result.assets.map((asset) => asset.uri);
      setImageUris((previous) => [...previous, ...selected].slice(0, 5));
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface elevation={2} style={styles.card}>
        <Text variant="headlineSmall">Create Activity</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Publish a new activity from mobile.
        </Text>

        <TextInput label="Title" value={title} onChangeText={setTitle} style={styles.input} />
        <TextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          style={styles.input}
        />
        <TextInput label="Location" value={location} onChangeText={setLocation} style={styles.input} />
        <TextInput
          label="Start date & time (ISO or YYYY-MM-DD HH:mm)"
          value={time}
          onChangeText={(value) => {
            setTime(value);
            if (timeError) {
              setTimeError(null);
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
            if (timeError) {
              setTimeError(null);
            }
          }}
          style={styles.input}
          autoCapitalize="none"
        />
        {timeError && (
          <HelperText type="error" visible>
            {timeError}
          </HelperText>
        )}
        <TextInput
          label="Capacity (1-10)"
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
          style={styles.input}
        />
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
          label="Tags (comma separated)"
          value={tags}
          onChangeText={setTags}
          style={styles.input}
        />
        <Button mode="outlined" onPress={fillCurrentLocation} loading={isLocating}>
          Use current location
        </Button>

        <TextInput label="Category" value={category} onChangeText={setCategory} style={styles.input} />
        <TextInput
          label="Visibility (everyone/friends/friendsOfFriends)"
          value={visibility}
          onChangeText={setVisibility}
          style={styles.input}
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

        <Button mode="outlined" onPress={handlePickImages}>
          Pick up to 5 images
        </Button>
        {!!imageUris.length && (
          <Text variant="bodySmall">Selected images: {imageUris.length}</Text>
        )}

        {createMutation.error && (
          <HelperText type="error" visible>
            {getErrorMessage(createMutation.error, 'Unable to create activity.')}
          </HelperText>
        )}

        {createMutation.isSuccess && (
          <HelperText type="info" visible>
            Activity created successfully.
          </HelperText>
        )}

        <Button
          mode="contained"
          loading={createMutation.isPending}
          disabled={!canSubmit || createMutation.isPending || isLocating}
          onPress={() => {
            const normalizedStartTime = normalizeDateTime(time);
            const normalizedEndTime = normalizeDateTime(endTime);

            if (!normalizedStartTime) {
              setTimeError('Start time format is invalid. Use ISO or YYYY-MM-DD HH:mm.');
              return;
            }

            if (endTime.trim() && !normalizedEndTime) {
              setTimeError('End time format is invalid. Use ISO or YYYY-MM-DD HH:mm.');
              return;
            }

            if (
              normalizedEndTime &&
              new Date(normalizedEndTime).getTime() <= new Date(normalizedStartTime).getTime()
            ) {
              setTimeError('End time must be after the start time.');
              return;
            }

            const visibilityValue = visibility.trim() || 'everyone';
            const validVisibility = ['everyone', 'friends', 'friendsOfFriends'];
            const normalizedVisibility = validVisibility.includes(visibilityValue)
              ? visibilityValue
              : 'everyone';

            createMutation.mutate({
              title: title.trim(),
              description: description.trim(),
              category: category.trim() || 'Social',
              location: location.trim(),
              time: normalizedStartTime,
              end_time: normalizedEndTime ?? undefined,
              capacity: Math.min(10, Math.max(1, Number(capacity) || 1)),
              latitude: Number(latitude) || 0,
              longitude: Number(longitude) || 0,
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
          }}
        >
          Create activity
        </Button>
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  half: {
    flex: 1,
  },
});
