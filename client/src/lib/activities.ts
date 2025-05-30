import type { Activity } from "@shared/schema";

export function calculateMatchScore(userInterests: string[], activityTags: string[]): number {
  if (!userInterests.length || !activityTags.length) return 0;
  
  const intersection = userInterests.filter(interest => 
    activityTags.some(tag => tag.toLowerCase().includes(interest.toLowerCase()))
  );
  
  return intersection.length / Math.max(userInterests.length, activityTags.length);
}

export function formatActivityTime(datetime: string): string {
  const date = new Date(datetime);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  
  return date.toLocaleDateString();
}

export function getActivityCategory(category: string): { color: string; emoji: string } {
  const categories: Record<string, { color: string; emoji: string }> = {
    "Sports & Fitness": { color: "bg-red-500", emoji: "🏃‍♂️" },
    "Food & Drinks": { color: "bg-orange-500", emoji: "🍽️" },
    "Outdoor Adventures": { color: "bg-green-500", emoji: "🌲" },
    "Arts & Culture": { color: "bg-purple-500", emoji: "🎨" },
    "Nightlife": { color: "bg-pink-500", emoji: "🌙" },
    "Learning": { color: "bg-blue-500", emoji: "📚" },
    "Social": { color: "bg-yellow-500", emoji: "👥" },
    "Gaming": { color: "bg-indigo-500", emoji: "🎮" },
    "Music": { color: "bg-violet-500", emoji: "🎵" },
    "Other": { color: "bg-gray-500", emoji: "📅" },
  };
  
  return categories[category] || categories["Other"];
}

export function isActivitySuitableForUser(activity: Activity, userPreferences: any): boolean {
  // Basic suitability checks
  if (activity.datetime && new Date(activity.datetime) < new Date()) {
    return false; // Past event
  }
  
  if (activity.status !== "active") {
    return false; // Inactive event
  }
  
  if (activity.currentParticipants >= activity.maxParticipants) {
    return false; // Full event
  }
  
  // Add more sophisticated matching logic here
  return true;
}
