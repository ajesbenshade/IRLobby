export interface DefaultProfileAvatar {
  id: string;
  label: string;
  url: string;
}

const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(
    seed
  )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&radius=50`;

export const DEFAULT_PROFILE_AVATARS: DefaultProfileAvatar[] = [
  { id: "sprout", label: "Sprout", url: avatarUrl("IRLobby Sprout") },
  { id: "spark", label: "Spark", url: avatarUrl("IRLobby Spark") },
  { id: "orbit", label: "Orbit", url: avatarUrl("IRLobby Orbit") },
  { id: "sunny", label: "Sunny", url: avatarUrl("IRLobby Sunny") },
  { id: "river", label: "River", url: avatarUrl("IRLobby River") },
  { id: "muse", label: "Muse", url: avatarUrl("IRLobby Muse") },
];
