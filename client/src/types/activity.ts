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
  is_private?: boolean;
  requires_approval?: boolean;
  tags: string[];
  images: string[];
  created_at: string;
  participant_count: number;
}