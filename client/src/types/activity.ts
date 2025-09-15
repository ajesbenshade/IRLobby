export interface Activity {
  id: number;
  host: string;
  title: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  time: string;
  capacity: number;
  tags: string[];
  images: string[];
  created_at: string;
  participant_count: number;
}