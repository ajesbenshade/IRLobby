import { z } from "zod";

export const API_ROUTES = {
  HEALTH: "/api/health/",
  AUTH_TOKEN: "/api/auth/token/",
  AUTH_REFRESH: "/api/auth/token/refresh/",
  AUTH_LOGOUT: "/api/auth/logout/",
  AUTH_REQUEST_PASSWORD_RESET: "/api/auth/request-password-reset/",
  AUTH_RESET_PASSWORD: "/api/auth/reset-password/",
  AUTH_PASSWORD_RESET_CONFIRM: "/api/auth/password-reset-confirm/",
  AUTH_GOOGLE_MOBILE: "/api/auth/google/mobile/",
  AUTH_APPLE_MOBILE: "/api/auth/apple/mobile/",
  AUTH_TWITTER_URL: "/api/auth/twitter/url/",
  AUTH_TWITTER_CALLBACK: "/api/auth/twitter/callback/",
  AUTH_TWITTER_STATUS: "/api/auth/twitter/status/",
  USER_PROFILE: "/api/users/profile/",
  USER_PROFILE_DELETE: "/api/users/profile/delete/",
  USER_PROFILE_EXPORT: "/api/users/profile/export/",
  USER_ONBOARDING: "/api/users/onboarding/",
  USER_INVITES: "/api/users/invites/",
  USER_PUSH_TOKENS: "/api/users/push-tokens/",
  USER_PUSH_TOKENS_DEACTIVATE: "/api/users/push-tokens/deactivate/",
  USER_AUTH_STATUS: "/api/users/auth/status/",
  USER_REGISTER: "/api/users/register/",
  USER_LOGIN: "/api/users/login/",
  ACTIVITIES: "/api/activities/",
  ACTIVITIES_HOSTED: "/api/activities/hosted/",
  SWIPES: "/api/swipes/",
  MATCHES: "/api/matches/",
  MESSAGES_CONVERSATIONS: "/api/messages/conversations/",
  REVIEWS: "/api/reviews/",
  MODERATION_BLOCKED: "/api/moderation/blocked/",
  MODERATION_REPORT: "/api/moderation/report/",
  TICKET_PURCHASE: "/api/activities/{activityId}/buy-ticket/",
  TICKETS_MY: "/api/activities/tickets/my/",
  TICKET_VALIDATE: "/api/activities/tickets/{ticketId}/validate/",
  STRIPE_WEBHOOK: "/api/activities/payments/webhook/",
} as const;

export type ApiRoute = (typeof API_ROUTES)[keyof typeof API_ROUTES];

export const API_ROUTE_BUILDERS = {
  activityJoin: (activityId: number | string) =>
    `${API_ROUTES.ACTIVITIES}${activityId}/join/`,
  activityLeave: (activityId: number | string) =>
    `${API_ROUTES.ACTIVITIES}${activityId}/leave/`,
  activitySwipe: (activityId: number | string) =>
    `${API_ROUTES.SWIPES}${activityId}/swipe/`,
  conversationMessages: (conversationId: number | string) =>
    `${API_ROUTES.MESSAGES_CONVERSATIONS}${conversationId}/messages/`,
  moderationBlock: (userId: number | string) =>
    `/api/moderation/block/${userId}/`,
  moderationUnblock: (userId: number | string) =>
    `/api/moderation/unblock/${userId}/`,
  activitiesWithSearch: (query: string) => `${API_ROUTES.ACTIVITIES}?${query}`,
  ticketPurchase: (activityId: number | string) =>
    `${API_ROUTES.ACTIVITIES}${activityId}/buy-ticket/`,
  myTickets: () => API_ROUTES.TICKETS_MY,
  validateTicket: (ticketId: number | string) =>
    `${API_ROUTES.ACTIVITIES}tickets/${ticketId}/validate/`,
} as const;

const nullableString = z.string().nullable();
const optionalNumber = z.number().nullable().optional();
const moneyValueSchema = z
  .union([z.number(), z.string()])
  .nullable()
  .optional();

export const ActivitySchema = z
  .object({
    id: z.number(),
    host: z.union([z.string(), z.object({}).passthrough()]).optional(),
    is_approved: z.boolean().optional(),
    title: z.string(),
    description: nullableString.optional(),
    category: z.string().optional(),
    location: nullableString.optional(),
    latitude: optionalNumber,
    longitude: optionalNumber,
    time: z.string().optional(),
    dateTime: z.string().optional(),
    end_time: nullableString.optional(),
    endDateTime: nullableString.optional(),
    capacity: z.number().optional(),
    maxParticipants: z.number().optional(),
    visibility: z.array(z.string()).optional(),
    is_private: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
    requires_approval: z.boolean().optional(),
    requiresApproval: z.boolean().optional(),
    price: moneyValueSchema,
    currency: z.string().optional(),
    age_restriction: z.string().optional(),
    ageRestriction: z.string().optional(),
    skill_level: z.string().optional(),
    skillLevel: z.string().optional(),
    equipment_provided: z.boolean().optional(),
    equipmentProvided: z.boolean().optional(),
    equipment_required: z.string().optional(),
    equipmentRequired: z.string().optional(),
    weather_dependent: z.boolean().optional(),
    weatherDependent: z.boolean().optional(),
    is_ticketed: z.boolean().optional(),
    isTicketed: z.boolean().optional(),
    ticket_price: moneyValueSchema,
    ticketPrice: moneyValueSchema,
    max_tickets: z.number().optional(),
    maxTickets: z.number().optional(),
    tickets_sold: z.number().optional(),
    ticketsSold: z.number().optional(),
    ticketsAvailable: z.number().optional(),
    isSoldOut: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    created_at: z.string().optional(),
    participant_count: z.number().optional(),
    max_participants: z.number().optional(),
  })
  .passthrough();

export const MatchConnectionSchema = z
  .object({
    id: z.number(),
    user_a: z.string(),
    user_b: z.string(),
  })
  .passthrough();

export const ConversationMessageSchema = z
  .object({
    id: z.number(),
    conversation: z.number().optional(),
    sender: z.number().optional(),
    sender_username: z.string().optional(),
    userId: z.union([z.number(), z.string()]).optional(),
    user: z.object({}).passthrough().optional(),
    message: z.string(),
    created_at: z.string().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export const ReviewSchema = z
  .object({
    id: z.number(),
    reviewer: z.number().optional(),
    reviewee: z.number().optional(),
    rating: z.number(),
    comment: z.string(),
    created_at: z.string(),
  })
  .passthrough();

export const TicketStatusSchema = z.enum([
  "pending",
  "paid",
  "used",
  "cancelled",
]);

export const TicketSchema = z
  .object({
    id: z.number(),
    ticketId: z.string(),
    activityId: z.number(),
    buyer: z.string().optional(),
    status: TicketStatusSchema,
    purchasedAt: z.string().optional(),
    redeemedAt: z.string().nullable().optional(),
    qrCodeDataUrl: z.string().nullable().optional(),
    created_at: z.string(),
  })
  .passthrough();

export const TicketPurchaseResponseSchema = z.object({
  session_id: z.string(),
});

export const TicketValidationResponseSchema = z
  .object({
    ticket_id: z.string(),
    activity_id: z.number(),
    buyer_username: z.string(),
    status: TicketStatusSchema,
    redeemed_at: z.string().optional(),
  })
  .passthrough();

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z
    .object({
      count: z.number().optional(),
      next: nullableString.optional(),
      previous: nullableString.optional(),
      results: z.array(itemSchema),
    })
    .passthrough();

export const ActivityListResponseSchema = z.union([
  z.array(ActivitySchema),
  PaginatedResponseSchema(ActivitySchema),
]);

export function parseActivityListResponse(value: unknown): Activity[] {
  const parsed = ActivityListResponseSchema.parse(value);
  return Array.isArray(parsed) ? parsed : parsed.results;
}

export type Activity = z.infer<typeof ActivitySchema>;
export type MatchConnection = z.infer<typeof MatchConnectionSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type TicketPurchaseResponse = z.infer<
  typeof TicketPurchaseResponseSchema
>;
export type TicketValidationResponse = z.infer<
  typeof TicketValidationResponseSchema
>;

export type VibeProfile =
  | "cozy_night_owl"
  | "hype_energy_host"
  | "creative_night_owl"
  | "deep_connector"
  | "adventure_seeker"
  | "wellness_wanderer";

export type VibeTag =
  | "board_games"
  | "live_music"
  | "cooking"
  | "outdoors"
  | "art"
  | "wellness"
  | "deep_talks"
  | "sports";

export interface VibeAnswers {
  q1?: string;
  q2?: string;
  q3?: VibeTag[];
  q4?: string;
  q5?: string;
}

export interface VibeQuizResult {
  vibeProfile: VibeProfile;
  vibeTags: VibeTag[];
  discoverTags: string[];
  answers: VibeAnswers;
  completedAt: string;
}

export const VIBE_PROFILE_LABELS: Record<
  VibeProfile,
  { name: string; emoji: string; tagline: string }
> = {
  cozy_night_owl: {
    name: "Cozy Night Owl",
    emoji: "🌙🧘",
    tagline: "Low-key plans, deep conversations, soft lighting.",
  },
  hype_energy_host: {
    name: "Hype Energy Host",
    emoji: "⚡🎉",
    tagline: "Big rooms, bigger laughs, the dance floor is yours.",
  },
  creative_night_owl: {
    name: "Creative Night Owl",
    emoji: "🌙🎨",
    tagline: "Late-night ideas, makers' hangs, magic under fairy lights.",
  },
  deep_connector: {
    name: "Cozy Deep Diver",
    emoji: "❤️💭",
    tagline: "Trusted circles, real talk, leave-it-better energy.",
  },
  adventure_seeker: {
    name: "Adventure Seeker",
    emoji: "🏔️⚡",
    tagline: "Outside, in motion, chasing the next story.",
  },
  wellness_wanderer: {
    name: "Wellness Wanderer",
    emoji: "🌿✨",
    tagline: "Sun, breath, intention — recharged the natural way.",
  },
};

export const VIBE_TAG_TO_DISCOVER: Record<VibeTag, string> = {
  board_games: "board games",
  live_music: "live music",
  cooking: "cooking",
  outdoors: "outdoors",
  art: "art",
  wellness: "wellness",
  deep_talks: "deep talks",
  sports: "sports",
};
