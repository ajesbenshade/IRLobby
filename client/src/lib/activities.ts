// Local Activity type matching our Django model
export type Activity = {
  id: number;
  host: string;
  title: string;
  description: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  time: string; // DateTime field
  capacity: number;
  tags: string[];
  images: string[];
  created_at: string;
  participant_count: number;
};

export function calculateMatchScore(userInterests: string[], activityTags: string[]): number {
  if (!userInterests.length || !activityTags.length) return 0;

  const intersection = userInterests.filter((interest) =>
    activityTags.some((tag) => tag.toLowerCase().includes(interest.toLowerCase())),
  );

  return intersection.length / Math.max(userInterests.length, activityTags.length);
}

export function formatActivityTime(datetime: string): string {
  const date = new Date(datetime);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;

  return date.toLocaleDateString();
}

export function getActivityCategory(category: string): { color: string; emoji: string } {
  const categories: Record<string, { color: string; emoji: string }> = {
    'Sports & Fitness': { color: 'bg-red-500', emoji: '\u{1F3C3}\u200d\u{2642}\uFE0F' },
    'Food & Drinks': { color: 'bg-orange-500', emoji: '\u{1F37D}\uFE0F' },
    'Outdoor Adventures': { color: 'bg-green-500', emoji: '\u{1F332}' },
    'Arts & Culture': { color: 'bg-purple-500', emoji: '\u{1F3A8}' },
    Nightlife: { color: 'bg-pink-500', emoji: '\u{1F319}' },
    Learning: { color: 'bg-blue-500', emoji: '\u{1F4DA}' },
    Social: { color: 'bg-yellow-500', emoji: '\u{1F465}' },
    Gaming: { color: 'bg-indigo-500', emoji: '\u{1F3AE}' },
    Music: { color: 'bg-violet-500', emoji: '\u{1F3B5}' },
    Other: { color: 'bg-gray-500', emoji: '\u{1F4C5}' },
  };

  return categories[category] || categories['Other'];
}

export function isActivitySuitableForUser(activity: Activity, _userPreferences: unknown): boolean {
  // Basic suitability checks
  if (activity.time && new Date(activity.time) < new Date()) {
    return false; // Past event
  }

  if (activity.participant_count && activity.participant_count >= activity.capacity) {
    return false; // Full event
  }

  // Add more sophisticated matching logic here
  return true;
}
