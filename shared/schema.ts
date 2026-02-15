export const API_ROUTES = {
	HEALTH: '/api/health/',
	AUTH_TOKEN: '/api/auth/token/',
	AUTH_REFRESH: '/api/auth/token/refresh/',
	AUTH_LOGOUT: '/api/auth/logout/',
	AUTH_REQUEST_PASSWORD_RESET: '/api/auth/request-password-reset/',
	AUTH_RESET_PASSWORD: '/api/auth/reset-password/',
	AUTH_PASSWORD_RESET_CONFIRM: '/api/auth/password-reset-confirm/',
	AUTH_TWITTER_URL: '/api/auth/twitter/url/',
	AUTH_TWITTER_CALLBACK: '/api/auth/twitter/callback/',
	AUTH_TWITTER_STATUS: '/api/auth/twitter/status/',
	USER_PROFILE: '/api/users/profile/',
	USER_PROFILE_DELETE: '/api/users/profile/delete/',
	USER_PROFILE_EXPORT: '/api/users/profile/export/',
	USER_ONBOARDING: '/api/users/onboarding/',
	USER_INVITES: '/api/users/invites/',
	USER_PUSH_TOKENS: '/api/users/push-tokens/',
	USER_PUSH_TOKENS_DEACTIVATE: '/api/users/push-tokens/deactivate/',
	USER_AUTH_STATUS: '/api/users/auth/status/',
	USER_REGISTER: '/api/users/register/',
	USER_LOGIN: '/api/users/login/',
	ACTIVITIES: '/api/activities/',
	ACTIVITIES_HOSTED: '/api/activities/hosted/',
	SWIPES: '/api/swipes/',
	MATCHES: '/api/matches/',
	MESSAGES_CONVERSATIONS: '/api/messages/conversations/',
	REVIEWS: '/api/reviews/',
} as const;

export type ApiRoute = (typeof API_ROUTES)[keyof typeof API_ROUTES];

export const API_ROUTE_BUILDERS = {
	activityJoin: (activityId: number | string) =>
		`${API_ROUTES.ACTIVITIES}${activityId}/join/`,
	activityLeave: (activityId: number | string) =>
		`${API_ROUTES.ACTIVITIES}${activityId}/leave/`,
	activitySwipe: (activityId: number | string) => `${API_ROUTES.SWIPES}${activityId}/swipe/`,
	conversationMessages: (conversationId: number | string) =>
		`${API_ROUTES.MESSAGES_CONVERSATIONS}${conversationId}/messages/`,
	activitiesWithSearch: (query: string) => `${API_ROUTES.ACTIVITIES}?${query}`,
} as const;

export interface Activity {
	id: number;
	title: string;
	description?: string;
	category: string;
	location?: string;
	latitude?: number;
	longitude?: number;
	participant_count?: number;
	max_participants?: number;
	is_private?: boolean;
}

export interface MatchConnection {
	id: number;
	user_a: string;
	user_b: string;
}

export interface ConversationMessage {
	id: number;
	conversation?: number;
	sender?: number;
	sender_username?: string;
	message: string;
	created_at: string;
}

export interface Review {
	id: number;
	reviewer?: number;
	reviewee?: number;
	rating: number;
	comment: string;
	created_at: string;
}
