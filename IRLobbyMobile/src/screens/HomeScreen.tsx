import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { activitiesAPI } from '../services/api';

interface Activity {
  id: number;
  title: string;
  description: string;
  location: string;
  date: string;
  participants_count: number;
}

export default function HomeScreen() {
  const { data: activities, isLoading, error } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const response = await activitiesAPI.getActivities();
      return response.json();
    },
  });

  const renderActivity = ({ item }: { item: Activity }) => (
    <TouchableOpacity style={styles.activityCard}>
      <Text style={styles.activityTitle}>{item.title}</Text>
      <Text style={styles.activityDescription}>{item.description}</Text>
      <Text style={styles.activityLocation}>📍 {item.location}</Text>
      <Text style={styles.activityDate}>📅 {item.date}</Text>
      <Text style={styles.participants}>
        👥 {item.participants_count} participants
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading activities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Error loading activities</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Activities</Text>
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  list: {
    paddingBottom: 20,
  },
  activityCard: {
    backgroundColor: '#ffffff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  activityLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  activityDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  participants: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: 'bold',
  },
});
