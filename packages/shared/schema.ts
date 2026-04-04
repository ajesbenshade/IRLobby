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
	TICKET_PURCHASE: '/api/activities/{activityId}/buy-ticket/',
	TICKETS_MY: '/api/activities/tickets/my/',
	TICKET_VALIDATE: '/api/activities/tickets/{ticketId}/validate/',
	STRIPE_WEBHOOK: '/api/activities/payments/webhook/',
} as const;

export const API_ROUTE_BUILDERS = {
	activityJoin: (activityId: number | string) =>
		`${API_ROUTES.ACTIVITIES}${activityId}/join/`,
	activityLeave: (activityId: number | string) =>
		`${API_ROUTES.ACTIVITIES}${activityId}/leave/`,
	activitySwipe: (activityId: number | string) => `${API_ROUTES.SWIPES}${activityId}/swipe/`,
	conversationMessages: (conversationId: number | string) =>
		`${API_ROUTES.MESSAGES_CONVERSATIONS}${conversationId}/messages/`,
	activitiesWithSearch: (query: string) => `${API_ROUTES.ACTIVITIES}?${query}`,
	ticketPurchase: (activityId: number | string) =>
		`${API_ROUTES.ACTIVITIES}${activityId}/buy-ticket/`,
	myTickets: () => API_ROUTES.TICKETS_MY,
	validateTicket: (ticketId: number | string) =>
		`${API_ROUTES.ACTIVITIES}tickets/${ticketId}/validate/`,
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

export interface Ticket {
	id: number;
	ticketId: string;
	activityId: number;
	buyer?: string;
	status: "pending" | "paid" | "used" | "cancelled";
	purchasedAt?: string;
	redeemedAt?: string;
	qrCodeDataUrl?: string;
	created_at: string;
}

export interface TicketPurchaseResponse {
	session_id: string;
}

export interface TicketValidationResponse {
	ticket_id: string;
	activity_id: number;
	buyer_username: string;
	status: "pending" | "paid" | "used" | "cancelled";
	redeemed_at?: string;
}
