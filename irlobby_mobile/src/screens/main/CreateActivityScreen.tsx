import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';

import { createActivity } from '@services/activityService';
import { getErrorMessage } from '@utils/error';

export const CreateActivityScreen = () => {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState('');
  const [capacity, setCapacity] = useState('6');
  const [latitude, setLatitude] = useState('0');
  const [longitude, setLongitude] = useState('0');
  const [tags, setTags] = useState('');

  const createMutation = useMutation({
    mutationFn: createActivity,
    onSuccess: async () => {
      setTitle('');
      setDescription('');
      setLocation('');
      setTime('');
      setCapacity('6');
      setLatitude('0');
      setLongitude('0');
      setTags('');

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
          label="Date & time (YYYY-MM-DDTHH:mm:ssZ)"
          value={time}
          onChangeText={setTime}
          style={styles.input}
          autoCapitalize="none"
        />
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
          disabled={!canSubmit || createMutation.isPending}
          onPress={() =>
            createMutation.mutate({
              title: title.trim(),
              description: description.trim(),
              location: location.trim(),
              time: time.trim(),
              capacity: Math.min(10, Math.max(1, Number(capacity) || 1)),
              latitude: Number(latitude) || 0,
              longitude: Number(longitude) || 0,
              tags: tags
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
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
  half: {
    flex: 1,
  },
});
