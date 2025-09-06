CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"host_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"location" varchar NOT NULL,
	"latitude" real,
	"longitude" real,
	"date_time" timestamp NOT NULL,
	"end_date_time" timestamp,
	"max_participants" integer NOT NULL,
	"current_participants" integer DEFAULT 0,
	"waitlist_count" integer DEFAULT 0,
	"is_private" boolean DEFAULT false,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"image_url" varchar,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"price" real DEFAULT 0,
	"currency" varchar DEFAULT 'USD',
	"requires_approval" boolean DEFAULT false,
	"age_restriction" varchar,
	"skill_level" varchar,
	"equipment_provided" boolean DEFAULT false,
	"equipment_required" text,
	"weather_dependent" boolean DEFAULT false,
	"status" varchar DEFAULT 'active',
	"cancellation_reason" text,
	"recurring_pattern" varchar,
	"reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"host_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"message" text,
	"host_message" text,
	"applied_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "activity_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_id" integer NOT NULL,
	"status" varchar DEFAULT 'pending',
	"joined_at" timestamp,
	"left_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"helpful" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_swipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_id" integer NOT NULL,
	"swipe_type" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"default_duration" integer,
	"default_max_participants" integer,
	"is_public" boolean DEFAULT false,
	"use_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"position" integer NOT NULL,
	"notified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_room_id" integer NOT NULL,
	"sender_id" varchar NOT NULL,
	"message" text NOT NULL,
	"message_type" varchar DEFAULT 'text',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_friends" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"rater_id" varchar NOT NULL,
	"rated_user_id" varchar NOT NULL,
	"activity_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"bio" text,
	"interests" jsonb DEFAULT '[]'::jsonb,
	"photo_album" jsonb DEFAULT '[]'::jsonb,
	"location" varchar,
	"latitude" real,
	"longitude" real,
	"rating" real DEFAULT 5,
	"total_ratings" integer DEFAULT 0,
	"events_hosted" integer DEFAULT 0,
	"events_attended" integer DEFAULT 0,
	"is_verified" boolean DEFAULT false,
	"verification_level" varchar DEFAULT 'none',
	"push_notifications" boolean DEFAULT true,
	"email_notifications" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_applications" ADD CONSTRAINT "activity_applications_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_applications" ADD CONSTRAINT "activity_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_applications" ADD CONSTRAINT "activity_applications_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_matches" ADD CONSTRAINT "activity_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_matches" ADD CONSTRAINT "activity_matches_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_reviews" ADD CONSTRAINT "activity_reviews_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_reviews" ADD CONSTRAINT "activity_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_swipes" ADD CONSTRAINT "activity_swipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_swipes" ADD CONSTRAINT "activity_swipes_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_templates" ADD CONSTRAINT "activity_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_waitlist" ADD CONSTRAINT "activity_waitlist_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_waitlist" ADD CONSTRAINT "activity_waitlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_room_id_chat_rooms_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_friends" ADD CONSTRAINT "user_friends_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_friends" ADD CONSTRAINT "user_friends_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_rated_user_id_users_id_fk" FOREIGN KEY ("rated_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");