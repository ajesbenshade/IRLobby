ALTER TABLE "users" ADD COLUMN "activity_reminders" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "new_match_notifications" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "message_notifications" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_visibility" varchar DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location_sharing" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "show_age" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "show_email" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "theme" varchar DEFAULT 'system';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" varchar DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "distance_unit" varchar DEFAULT 'miles';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "max_distance" integer DEFAULT 25;